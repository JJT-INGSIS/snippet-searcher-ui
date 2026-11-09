import {AUDIENCE, CLIENT_ID, FakeUser, auth0Config, auth0Network} from './auth0Network';

const ana: FakeUser = {sub: 'auth0|ana', name: 'Ana Gómez', email: 'ana@example.com', accessToken: 'access-token-ana'};
const bruno: FakeUser = {sub: 'auth0|bruno', name: 'Bruno Díaz', email: 'bruno@example.com', accessToken: 'access-token-bruno'};
const snippetId = '0f8b3c1e-4a2d-4d3b-9b7a-2c6e5f1a9d40';
const lint = {status: 'pending', reason: 'NOT_EVALUATED', diagnostics: [], codeHash: null, rulesRevision: null, processorRevision: null};
const descriptor = (name: string) => ({
  id: snippetId, name, description: null, language: 'printscript', version: '1.1', extension: 'prs',
  ownerId: 'auth0|ana', relation: 'owned', lint,
});

function api(owner: () => FakeUser) {
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.1']}]);
  cy.intercept('GET', '/api/snippets?*', req => {
    expect(req.headers['x-dev-actor-id']).to.be.undefined;
    const token = String(req.headers.authorization ?? '');
    const name = token === 'Bearer ' + ana.accessToken ? 'Privado de Ana' : 'Privado de Bruno';
    req.reply({page: 0, page_size: 10, count: 1, snippets: [descriptor(name)]});
  }).as('list');
  cy.intercept('GET', '/api/formatting-rules/*/*', req => {
    const [language, version] = new URL(req.url).pathname.split('/').slice(-2);
    req.reply({language, version, revision: 'sha256-v1:' + 'a'.repeat(64), changed: false, jobId: null, rules: []});
  });
  cy.intercept('GET', '/api/linting-rules/*/*', req => {
    const [language, version] = new URL(req.url).pathname.split('/').slice(-2);
    req.reply({language, version, revision: 'sha256-v1:' + 'b'.repeat(64), changed: false, jobId: null, rules: []});
  });
  return owner;
}

describe('SNI-73 login, callback and logout with Auth0 simulated on the network', () => {
  it('shows the welcome screen without touching the API until there is a session', () => {
    auth0Config(); auth0Network(() => ana);
    cy.intercept('/api/**', () => {throw new Error('No API call is allowed without a session');});
    cy.visit('/rules');
    cy.contains('Tu código, ordenado y listo para compartir').should('be.visible');
    cy.contains('a', 'Reglas').should('not.exist');
    cy.screenshot('sni73-welcome', {capture: 'viewport'});
  });

  it('logs in with Authorization Code and PKCE, returns to the requested screen and sends only the bearer token', () => {
    auth0Config(); auth0Network(() => ana); api(() => ana);
    cy.visit('/rules');
    cy.get('[data-testid="login"]').click();
    cy.wait('@authorize').then(({request}) => {
      const query = new URL(request.url).searchParams;
      expect(query.get('response_type')).to.eq('code');
      expect(query.get('code_challenge_method')).to.eq('S256');
      expect(query.get('code_challenge')).to.have.length.greaterThan(40);
      expect(query.get('client_id')).to.eq(CLIENT_ID);
      expect(query.get('audience')).to.eq(AUDIENCE);
      expect(query.get('redirect_uri')).to.eq(Cypress.config('baseUrl') + '/auth/callback');
      expect(query.get('scope')).to.include('openid').and.include('profile').and.include('email');
      expect(query.get('state')).to.have.length.greaterThan(10);
      expect(query.has('client_secret')).to.eq(false);
    });
    cy.wait('@token');
    cy.location('pathname').should('eq', '/rules');
    cy.location('search').should('eq', '');
    cy.contains('h1', 'Reglas de código').should('be.visible');
    cy.contains('button', 'Ana Gómez').should('be.visible');
    cy.contains('a', 'Snippets').click();
    cy.wait('@list').its('request.headers.authorization').should('eq', 'Bearer ' + ana.accessToken);
    cy.contains('Privado de Ana').should('be.visible');
    cy.screenshot('sni73-signed-in', {capture: 'viewport'});
    cy.contains('button', 'Ana Gómez').click();
    cy.get('#user-menu').contains('ana@example.com').should('be.visible');
    cy.screenshot('sni73-user-menu', {capture: 'viewport'});
  });

  it('rejects a forged callback with a fixed message, cleans the URL and calls no API', () => {
    auth0Config(); auth0Network(() => ana);
    cy.intercept('/api/**', () => {throw new Error('No API call is allowed after a forged callback');});
    cy.visit('/auth/callback?code=stolen&state=forged&returnTo=https://evil.example');
    cy.contains('No pudimos completar el inicio de sesión').should('be.visible');
    cy.contains('El enlace de inicio de sesión no es válido o ya se usó.').should('be.visible');
    cy.contains('evil.example').should('not.exist');
    cy.location('search').should('eq', '');
    cy.screenshot('sni73-callback-error', {capture: 'viewport'});
  });

  it('explains a login cancelled at Auth0', () => {
    auth0Config(); auth0Network(() => ana, () => ({error: 'access_denied'}));
    cy.visit('/');
    cy.get('[data-testid="login"]').click();
    cy.wait('@authorize');
    cy.contains('Se canceló el inicio de sesión o no se otorgó el acceso.').should('be.visible');
  });

  it('logs out, forgets the private data and shows nothing of the previous user to the next one', () => {
    let current = ana;
    auth0Config(); auth0Network(() => current); api(() => current);
    cy.visit('/');
    cy.get('[data-testid="login"]').click();
    cy.wait('@list'); cy.contains('Privado de Ana').should('be.visible');
    cy.contains('button', 'Ana Gómez').click();
    cy.contains('[role="menuitem"]', 'Cerrar sesión').click();
    cy.wait('@logout').then(({request}) => {
      const query = new URL(request.url).searchParams;
      expect(query.get('client_id')).to.eq(CLIENT_ID);
      expect(query.get('returnTo')).to.eq(Cypress.config('baseUrl') + '/');
    });
    cy.contains('Tu código, ordenado y listo para compartir').should('be.visible');
    cy.contains('Privado de Ana').should('not.exist');
    cy.then(() => {current = bruno;});
    cy.get('[data-testid="login"]').click();
    cy.wait('@list').its('request.headers.authorization').should('eq', 'Bearer ' + bruno.accessToken);
    cy.contains('Privado de Bruno').should('be.visible');
    cy.contains('Privado de Ana').should('not.exist');
  });

  it('keeps the draft when the API rejects the token and never repeats the save', () => {
    auth0Config(); auth0Network(() => ana); api(() => ana);
    cy.intercept('GET', '/api/snippets/' + snippetId, {
      ...descriptor('Privado de Ana'), code: 'println(1);', capabilities: {modify: true, share: true},
    }).as('detail');
    cy.intercept('PUT', '/api/snippets/' + snippetId, {
      statusCode: 401, headers: {'www-authenticate': 'Bearer'}, body: {type: 'urn:snippets:problem:identity-unavailable', status: 401},
    }).as('save');
    cy.visit('/');
    cy.get('[data-testid="login"]').click();
    cy.wait('@list');
    cy.contains('button', 'Privado de Ana').click(); cy.wait('@detail');
    cy.get('#detail-name').clear().type('Nombre sin guardar');
    cy.get('[data-testid="save-changes"]').click(); cy.wait('@save');
    cy.get('[role="dialog"]').contains('Tu sesión venció').should('be.visible');
    cy.screenshot('sni73-session-expired', {capture: 'viewport'});
    cy.contains('button', 'Ahora no').click();
    cy.get('#detail-name').should('have.value', 'Nombre sin guardar');
    cy.get('@save.all').should('have.length', 1);
  });

  it('shows its own page for unknown addresses', () => {
    auth0Config(); auth0Network(() => ana);
    cy.visit('/admin/../etc');
    cy.contains('No encontramos esa página').should('be.visible');
    cy.screenshot('sni73-not-found', {capture: 'viewport'});
  });

  it('fails explicitly with an unsafe configuration instead of opening the app', () => {
    auth0Config({audience: 'http://jjt-snippets-dev.duckdns.org/api'});
    cy.intercept('/api/**', () => {throw new Error('No API call is allowed with an invalid configuration');});
    cy.visit('/');
    cy.contains('No se pudo cargar la configuración.').should('be.visible');
    cy.contains('Iniciar sesión').should('not.exist');
  });
});

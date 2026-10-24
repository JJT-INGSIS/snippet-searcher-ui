// These are browser integration tests against the agreed contracts, NOT backend acceptance.
const id = '0f8b3c1e-4a2d-4d3b-9b7a-2c6e5f1a9d40';
const metadata = {id, name: 'Hello', description: null, language: 'printscript', version: '1.0'};
const descriptor = {...metadata, extension: 'prs', ownerId: 'dev-juan', relation: 'owned', lint: {status: 'not-implemented'}};
const detail = {...descriptor, code: 'println(1);', capabilities: {modify: true, share: true}};
function setup(readonly = false) {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]).as('catalog');
  cy.intercept('GET', '/api/snippets?*', {page: 0, page_size: 10, count: 1, snippets: [descriptor]}).as('list');
  cy.intercept('GET', '/api/snippets/' + id, readonly
    ? {...detail, relation: 'shared', capabilities: {modify: false, share: false}} : detail).as('detail');
  cy.intercept('GET', '/api/users?*', req => {
    expect(req.query.page).to.eq('0');
    req.reply({page: 0, page_size: 5, count: 1, users: [{id: 'dev-ana', name: 'Ana'}]});
  }).as('users');
  cy.visit('/'); cy.wait('@list');
}
function openCreate() {
  cy.contains('button', 'Nuevo snippet').click();
  cy.contains('li', 'Crear snippet').click();
  cy.get('#name').type('New snippet');
  cy.get('#language').click(); cy.get('[role="option"]').contains('printscript').click();
  cy.get('#version').click(); cy.get('[role="option"]').contains('1.0').click();
  cy.get('#create-code').type('println(1);');
}
describe('SNI-34 UI / pending backend contracts', () => {
  it('sends correct create DTO, retries the same intent after an uncertain failure, and refreshes the list', () => {
    setup(); openCreate();
    let firstKey: unknown;
    let firstBody: unknown;
    let attempts = 0;
    cy.intercept('POST', '/api/snippets', req => {
      attempts++;
      expect(req.body).to.deep.eq({name: 'New snippet', description: null, language: 'printscript', version: '1.0', code: 'println(1);'});
      expect(req.headers['x-dev-actor-id']).to.eq('dev-juan');
      if (attempts === 1) {
        firstKey = req.headers['idempotency-key']; firstBody = req.body;
        expect(firstKey).to.match(/^[0-9a-f-]{36}$/);
        req.reply(503, {type: 'urn:snippets:problem:storage-unavailable'});
      } else {
        expect(req.headers['idempotency-key']).to.eq(firstKey);
        expect(req.body).to.deep.eq(firstBody);
        req.reply(200, {...metadata, name: 'New snippet'});
      }
    }).as('create');
    cy.get('[data-testid="save-snippet"]').click(); cy.wait('@create');
    cy.contains('Reintentar misma creación').should('be.visible');
    cy.get('#name').should('be.disabled');
    cy.get('[data-testid="save-snippet"]').click(); cy.wait('@create'); cy.wait('@list');
    cy.contains('[role=dialog] h2', 'Nuevo snippet').should('not.exist');
  });
  it('shows parser diagnostics and preserves the draft', () => {
    setup(); openCreate();
    cy.intercept('POST', '/api/snippets', {statusCode: 422, body: {
      type: 'urn:snippets:problem:invalid-code', status: 422,
      diagnostics: [{rule: 'syntax', message: 'Expected semicolon', line: 2, column: 3}],
    }}).as('invalid');
    cy.get('[data-testid="save-snippet"]').click(); cy.wait('@invalid');
    cy.contains('Expected semicolon (2:3)').should('be.visible');
    cy.get('#create-code').should('have.value', 'println(1);');
    cy.get('#name').should('not.be.disabled');
  });
  it('requires a catalog instead of inventing language/version', () => {
    setup();
    cy.intercept('GET', '/api/languages', {statusCode: 404, body: {type: 'about:blank'}});
    cy.reload(); cy.wait('@list');
    cy.contains('button', 'Nuevo snippet').click(); cy.contains('li', 'Crear snippet').click();
    cy.contains('No se pudo cargar el catálogo').should('be.visible');
    cy.get('[data-testid="save-snippet"]').should('be.disabled');
  });
  it('uploads text through the same JSON creation contract', () => {
    setup(); cy.wait('@catalog');
    cy.get('[data-testid="upload-file-input"]').selectFile({contents: Cypress.Buffer.from('println(2);\r\n'), fileName: 'uploaded.prs'}, {force: true});
    cy.get('#name').should('have.value', 'uploaded');
    cy.get('#create-code').should('have.value', 'println(2);\n');
    cy.get('#version').click(); cy.get('[role="option"]').contains('1.1').click();
    cy.intercept('POST', '/api/snippets', req => {
      // Textareas normalize line endings; the adapter itself does not trim/normalize source.
      expect(req.body.code).to.eq('println(2);\r\n');
      expect(req.body.version).to.eq('1.1');
      expect(req.body).not.to.have.property('extension');
      req.reply(201, {...metadata, name: 'uploaded', version: '1.1'});
    }).as('upload');
    cy.get('[data-testid="save-snippet"]').click(); cy.wait('@upload');
  });
  it('honors read-only capabilities and disables unavailable actions', () => {
    setup(true); cy.get('[data-testid="snippet-row"] button').click(); cy.wait('@detail');
    cy.get('#detail-code').should('have.attr', 'readonly');
    cy.get('[data-testid="save-changes"]').should('be.disabled');
    cy.contains('button', 'Compartir').should('be.disabled');
    cy.contains('button', 'Ejecutar tests').should('be.disabled');
    cy.contains('button', 'Formatear').should('be.disabled');
    cy.contains('button', 'Eliminar').should('be.disabled');
    cy.contains('Sin evaluación').should('be.visible');
  });
  it('keeps a confirmed save successful even if the independent detail refresh fails', () => {
    setup(); cy.get('[data-testid="snippet-row"] button').click(); cy.wait('@detail');
    cy.get('#detail-code').clear().type('println(2);');
    cy.intercept('PUT', '/api/snippets/' + id, req => {
      expect(req.body).to.deep.eq({name: 'Hello', description: null, language: 'printscript', version: '1.0', code: 'println(2);'});
      req.reply(200, metadata);
    }).as('save');
    // No extra request in the adapter; the hook independently invalidates cached queries.
    cy.intercept('GET', '/api/snippets/' + id, {statusCode: 503, body: {type: 'urn:snippets:problem:storage-unavailable'}});
    cy.get('[data-testid="save-changes"]').click(); cy.wait('@save');
    cy.contains('Cambios guardados.').scrollIntoView().should('be.visible');
    cy.contains('No pudimos acceder al contenido').scrollIntoView().should('be.visible');
    cy.get('#detail-code').should('have.value', 'println(2);');
  });
  it('only closes sharing after a confirmed response; a failure remains retryable', () => {
    setup(); cy.get('[data-testid="snippet-row"] button').click(); cy.wait('@detail');
    cy.contains('button', 'Compartir').click(); cy.wait('@users');
    cy.get('input[role="combobox"]').click(); cy.get('[role="option"]').contains('Ana').click();
    let calls = 0;
    cy.intercept('PUT', '/api/snippets/' + id + '/shares/dev-ana', req => {
      if (++calls === 1) req.reply(502, {type: 'urn:snippets:problem:dependency-failure'});
      else req.reply(201, {snippetId: id, userId: 'dev-ana'});
    }).as('share');
    cy.get('[data-testid="confirm-share"]').click(); cy.wait('@share');
    cy.contains('Compartir snippet').should('be.visible');
    cy.contains('No pudimos comunicarnos').should('be.visible');
    cy.get('[data-testid="confirm-share"]').click(); cy.wait('@share');
    cy.contains('Compartir snippet').should('not.exist');
  });
});

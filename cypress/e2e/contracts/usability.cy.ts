// UI regressions against controlled HTTP contracts, not full backend acceptance.
const item = (name = 'Ejemplo', id = '0f8b3c1e-4a2d-4d3b-9b7a-2c6e5f1a9d40') => ({
  id, name, description: null, language: 'printscript', version: '1.1', extension: 'prs',
  ownerId: 'dev-juan', relation: 'owned', lint: {status: 'not-implemented'},
});
function config() {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]);
}
function listing() {
  config();
  cy.intercept('GET', '/api/snippets?*', req => {
    const page = Number(req.query.page), size = Number(req.query.page_size), name = String(req.query.name || '');
    const count = name === 'inexistente' ? 0 : name ? 1 : 42;
    req.reply({page, page_size: size, count, snippets: count && page * size < count ? [item(name || 'Ejemplo')] : []});
  }).as('list');
  cy.visit('/'); cy.wait('@list');
}
function search(value: string) {cy.get('input[placeholder="Nombre del snippet…"]').clear().type(value);}
describe('SNI-35 search, pagination and feedback', () => {
  it('resets an advanced page on search and handles zero results without keeping the old total', () => {
    listing();
    cy.get('[aria-label="Página siguiente"]').click(); cy.wait('@list');
    cy.get('[aria-label="Página siguiente"]').click(); cy.wait('@list');
    search('único');
    cy.wait('@list').its('request.query').should('include', {page: '0', name: 'único'});
    cy.contains('1 snippet').should('be.visible');
    search('inexistente'); cy.wait('@list');
    cy.contains('0 snippets').should('be.visible');
    cy.contains('No encontramos coincidencias').should('be.visible');
    cy.get('[data-testid="snippet-row"]').should('not.exist');
    cy.contains('button', 'Limpiar filtros').first().click(); cy.wait('@list');
    cy.contains('42 snippets').should('be.visible');
  });
  it('resets page when size or filters change and remains zero based', () => {
    listing(); cy.get('[aria-label="Página siguiente"]').click(); cy.wait('@list');
    cy.get('.MuiTablePagination-select').click();
    cy.get('[role="option"]').contains('25').click();
    cy.wait('@list').its('request.query').should('include', {page: '0', page_size: '25'});
    cy.get('[aria-label="Página siguiente"]').click(); cy.wait('@list');
    cy.get('[role="combobox"]').first().click(); cy.get('[role="option"]').contains('Mis snippets').click();
    cy.wait('@list').its('request.query').should('include', {page: '0', relation: 'owned'});
  });
  it('recovers a valid page when the server total shrinks', () => {
    listing();
    cy.intercept('GET', '/api/snippets?*', req => {
      req.reply({page: Number(req.query.page), page_size: 10, count: 1, snippets: req.query.page === '0' ? [item('Vigente')] : []});
    }).as('shrunk');
    cy.get('[aria-label="Página siguiente"]').click(); cy.wait('@shrunk'); cy.wait('@shrunk');
    cy.contains('button', 'Vigente').should('be.visible');
    cy.get('[aria-label="Página anterior"]').should('be.disabled');
  });
  it('does not present an earlier response as the current search', () => {
    listing();
    cy.intercept('GET', '/api/snippets?*', req => {
      const name = String(req.query.name);
      if (name === 'anterior') req.reply({delay: 900, body: {page: 0, page_size: 10, count: 1, snippets: [item('Respuesta anterior')]}});
      else req.reply({page: 0, page_size: 10, count: 1, snippets: [item('Respuesta vigente')]});
    }).as('search');
    search('anterior');
    cy.wait(400); // Ensure the older request is in flight before changing its identity.
    search('actual');
    cy.contains('button', 'Respuesta vigente').should('be.visible');
    cy.wait(1000); // The slow response must have had time to finish.
    cy.contains('button', 'Respuesta vigente').should('be.visible');
    cy.contains('button', 'Respuesta anterior').should('not.exist');
  });
  it('distinguishes failures from emptiness and offers a working retry', () => {
    config();
    let calls = 0;
    cy.intercept('GET', '/api/snippets?*', req => {
      if (++calls === 1) req.reply(502, {type: 'urn:snippets:problem:dependency-failure'});
      else req.reply({page: 0, page_size: 10, count: 0, snippets: []});
    }).as('list');
    cy.visit('/'); cy.wait('@list');
    cy.contains('No pudimos comunicarnos').should('be.visible');
    cy.contains('Todavía no hay snippets').should('not.exist');
    cy.contains('button', 'Reintentar listado').click(); cy.wait('@list');
    cy.contains('Todavía no hay snippets').should('be.visible');
  });
  it('does not hide the editor for the inherited snake_case_variable trigger and keeps drafts after refetch', () => {
    listing();
    let detailRequests = 0;
    cy.intercept('GET', '/api/snippets/*', req => req.reply({...item(), code: ++detailRequests === 1
      ? 'let snake_case_variable: number = 1;' : 'println(999);', capabilities: {modify: true, share: true}})).as('detail');
    cy.get('[data-testid="snippet-row"] button').focus().should('have.focus').click(); cy.wait('@detail');
    cy.wait(5200);
    cy.get('#detail-code').should('be.visible').and('contain.value', 'snake_case_variable');
    cy.get('#detail-code').clear().type('println(77);');
    cy.window().then(win => win.dispatchEvent(new Event('focus')));
    cy.wait('@detail');
    cy.get('#detail-code').should('be.visible').and('have.value', 'println(77);');
    cy.contains('button', 'Guardar cambios').should('be.enabled');
  });
  it('supports mobile layout, labeled dialogs and returning focus after keyboard dismissal', () => {
    cy.viewport(390, 844); listing();
    cy.get('nav[aria-label="Navegación principal"]').should('be.visible');
    cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth));
    cy.contains('button', 'Nuevo snippet').click(); cy.contains('li', 'Crear snippet').click();
    cy.get('[role="dialog"]').should('have.attr', 'aria-labelledby').then(id => cy.get('[id="' + id + '"]').should('contain.text', 'Nuevo snippet'));
    cy.get('#name').focus().type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.focused().should('contain.text', 'Nuevo snippet');
  });
  it('closes queued upload messages after their timeout', () => {
    listing();
    cy.get('[data-testid="upload-file-input"]').selectFile({contents: Cypress.Buffer.from('x'), fileName: 'unknown.xyz'}, {force: true});
    cy.contains('La extensión del archivo').should('be.visible');
    cy.contains('La extensión del archivo', {timeout: 9000}).should('not.exist');
  });
});

// Only the explicit dev identity configuration is supplied by the test.
// No /api, Permissions, interpreter, database or Asset response is stubbed.
const phase = Cypress.env('SNI36_PHASE') || 'healthy';
function visitAs(actorId: string) {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId}});
  cy.intercept('GET', '/api/snippets?*').as('list');
  cy.visit('/');
}
describe('SNI-36 / real providers and sharing', () => {
  before(() => {
    expect(['healthy', 'permissions-down', 'storage-down']).to.include(phase);
    expect(new URL(Cypress.config('baseUrl') || '').hostname).to.be.oneOf(['127.0.0.1', 'localhost', '[::1]']);
  });
  (phase === 'healthy' ? it : it.skip)('creates, updates and shares through the UI; recipient is read-only and a third actor cannot read', () => {
    const name = 'SNI36-browser-' + Date.now();
    const code = 'println("original ñ");';
    const updated = 'println("actualizado ñ");\nprintln(4);';
    let snippetId = '';
    cy.viewport(1440, 1000);
    visitAs('dev-thiago'); cy.wait('@list').its('response.statusCode').should('eq', 200);
    cy.contains('button', 'Nuevo snippet').click(); cy.contains('li', 'Crear snippet').click();
    cy.get('#name').type(name);
    cy.get('#language').click(); cy.contains('[role="option"]', 'printscript').click();
    cy.get('#version').click(); cy.contains('[role="option"]', '1.1').click();
    cy.get('#create-code').type(code, {parseSpecialCharSequences: false});
    cy.intercept('POST', '/api/snippets').as('create');
    cy.get('[data-testid="save-snippet"]').click();
    cy.wait('@create').then(({response}) => {expect(response?.statusCode).to.eq(201); snippetId = response?.body.id;});
    cy.get('input[placeholder="Nombre del snippet…"]').type(name);
    cy.contains('[data-testid="snippet-row"] button', name).click();
    cy.get('#detail-code').should('have.value', code).clear().type(updated, {parseSpecialCharSequences: false});
    cy.intercept('PUT', '/api/snippets/*').as('update');
    cy.get('[data-testid="save-changes"]').click(); cy.wait('@update').its('response.statusCode').should('eq', 200);
    cy.contains('Cambios guardados.').should('be.visible');
    cy.contains('button', /^Compartir$/).click();
    cy.get('input[role="combobox"]').type('Ana'); cy.contains('[role="option"]', 'Ana').click();
    cy.intercept('PUT', '/api/snippets/*/shares/dev-ana').as('share');
    cy.get('[data-testid="confirm-share"]').click(); cy.wait('@share').its('response.statusCode').should('eq', 201);
    cy.screenshot('sni36-owner-shared', {capture: 'viewport'});

    visitAs('dev-ana'); cy.wait('@list').its('response.statusCode').should('eq', 200);
    cy.get('input[placeholder="Nombre del snippet…"]').type(name);
    cy.contains('[data-testid="snippet-row"] button', name).click();
    cy.get('#detail-code').should('have.value', updated).and('have.attr', 'readonly');
    cy.get('[data-testid="save-changes"]').should('be.disabled');
    cy.contains('button', /^Compartir$/).should('be.disabled');
    cy.viewport(390, 844); cy.screenshot('sni36-reader-mobile', {capture: 'viewport'});

    visitAs('dev-bruno'); cy.wait('@list').its('response.statusCode').should('eq', 200);
    cy.get('input[placeholder="Nombre del snippet…"]').type(name);
    cy.contains('No encontramos coincidencias').should('be.visible');
    cy.then(() => cy.request({url: '/api/snippets/' + snippetId, headers: {'X-Dev-Actor-Id': 'dev-bruno'}, failOnStatusCode: false}))
      .its('status').should('eq', 404);
  });

  (phase === 'permissions-down' ? it : it.skip)('displays a real dependency failure instead of a fictitious empty list', () => {
    visitAs('dev-thiago'); cy.wait('@list').its('response.statusCode').should('eq', 502);
    cy.contains('No pudimos comunicarnos con un servicio necesario.').should('be.visible');
    cy.contains('No encontramos coincidencias').should('not.exist');
    cy.screenshot('sni36-permissions-outage', {capture: 'viewport'});
  });

  (phase === 'storage-down' ? it : it.skip)('displays a real storage failure without manufacturing snippet content', () => {
    const path = Cypress.env('SNI36_EVIDENCE_FILE');
    expect(path, 'external evidence from the healthy backend phase').to.be.a('string').and.not.be.empty;
    cy.readFile(path).then(record => {
      visitAs('dev-thiago'); cy.wait('@list').its('response.statusCode').should('eq', 200);
      cy.get('input[placeholder="Nombre del snippet…"]').type(record.name);
      cy.contains('[data-testid="snippet-row"] button', record.name).click();
      cy.contains('No pudimos acceder al contenido.').should('be.visible');
      cy.get('#detail-code').should('not.exist');
      cy.contains('Cambios guardados.').should('not.exist');
      cy.screenshot('sni36-storage-outage', {capture: 'viewport'});
      cy.get('[aria-label="Cerrar detalle"]').click();
      cy.contains('button', 'Nuevo snippet').click(); cy.contains('li', 'Crear snippet').click();
      const failedName = 'SNI36-pending-' + Date.now();
      cy.get('#name').type(failedName);
      cy.get('#language').click(); cy.contains('[role="option"]', 'printscript').click();
      cy.get('#version').click(); cy.contains('[role="option"]', '1.1').click();
      cy.get('#create-code').type('println(1);', {parseSpecialCharSequences: false});
      cy.intercept('POST', '/api/snippets').as('failedCreate');
      cy.get('[data-testid="save-snippet"]').click();
      cy.wait('@failedCreate').its('response.statusCode').should('eq', 503);
      cy.get('#name').should('have.value', failedName);
      cy.get('#create-code').should('have.value', 'println(1);');
      cy.contains('No pudimos acceder al contenido.').should('be.visible');
      cy.request({url: '/api/snippets', qs: {name: failedName}, headers: {'X-Dev-Actor-Id': 'dev-thiago'}})
        .its('body.count').should('eq', 0);
      cy.screenshot('sni36-creation-not-confirmed', {capture: 'viewport'});
    });
  });
});

// Real API, PostgreSQL, Redis, PrintScript, Permissions and Asset; only dev identity config is supplied.
describe('SNI-69 automatic tests with real providers', () => {
  it('shows exact automatic results to owner and current reader and hides them from a third actor', () => {
    expect(new URL(Cypress.config('baseUrl') || '').hostname).to.be.oneOf(['localhost', '127.0.0.1', '[::1]']);
    const name = 'SNI69-browser-' + Date.now();
    const headers = {'X-Dev-Actor-Id': 'dev-thiago'};
    const payload = {name, description: null, language: 'printscript', version: '1.1', code: 'println(1);'};
    let snippetId = '';
    cy.request({method: 'POST', url: '/api/snippets', headers: {...headers, 'Idempotency-Key': crypto.randomUUID()}, body: payload}).then(response => {
      expect(response.status).to.eq(201); snippetId = response.body.id;
      cy.request({method: 'POST', url: '/api/snippets/' + snippetId + '/tests', headers, body: {inputs: [], expectedOutputs: ['2']}}).its('status').should('eq', 201);
      cy.request({method: 'POST', url: '/api/snippets/' + snippetId + '/tests', headers, body: {inputs: [], expectedOutputs: ['different']}}).its('status').should('eq', 201);
      cy.request({method: 'PUT', url: '/api/snippets/' + snippetId + '/shares/dev-ana', headers}).its('status').should('eq', 201);
    });
    function openAs(actorId: string) {
      cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId}});
      cy.visit('/');
      cy.get('input[placeholder="Nombre del snippet…"]').type(name);
      cy.contains('[data-testid="snippet-row"] button', name).click();
    }
    openAs('dev-thiago');
    cy.get('#detail-code').clear(); cy.get('#detail-code').type('println(2);', {parseSpecialCharSequences: false});
    cy.get('[data-testid="save-changes"]').click();
    cy.contains('Cambios guardados.').should('be.visible');
    cy.get('[aria-label="Tests automáticos"]').within(() => {
      cy.contains('Test 1:', {timeout: 45000}).should('exist');
      cy.contains('Aprobado', {timeout: 45000}).should('exist');
      cy.contains('No coincide', {timeout: 45000}).should('exist');
      cy.contains('Estado: COMPLETED').should('exist');
    });
    cy.then(() => cy.request({url: '/api/snippets/' + snippetId + '/automatic-tests', headers})).then(response => {
      expect(response.body.validity).to.eq('CURRENT');
      expect(response.body.tests.map((test: {comparison: string}) => test.comparison).sort()).to.deep.eq(['FAILED', 'PASSED']);
      expect(response.body.tests.every((test: {outputs: string[]}) => JSON.stringify(test.outputs) === '["2"]')).to.eq(true);
    });
    cy.screenshot('sni69-owner-results', {capture: 'viewport'});
    openAs('dev-ana');
    cy.get('#detail-code').should('have.attr', 'readonly');
    cy.get('[aria-label="Tests automáticos"]').contains('Aprobado').should('exist');
    cy.get('[aria-label="Tests automáticos"]').contains('No coincide').should('exist');
    cy.screenshot('sni69-reader-results', {capture: 'viewport'});
    cy.then(() => cy.request({url: '/api/snippets/' + snippetId + '/automatic-tests', headers: {'X-Dev-Actor-Id': 'dev-bruno'}, failOnStatusCode: false})).its('status').should('eq', 404);
    cy.then(() => cy.request({method: 'POST', url: '/api/snippets/' + snippetId + '/tests', headers, body: {inputs: [], expectedOutputs: []}}));
    cy.then(() => cy.request({url: '/api/snippets/' + snippetId + '/automatic-tests', headers})).then(response => {
      expect(response.body.validity).to.eq('SUPERSEDED'); expect(response.body.tests).to.deep.eq([]);
    });
  });
});

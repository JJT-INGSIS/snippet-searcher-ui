// Opt-in: real local backend via Vite. No stubbed responses, VMs or pending endpoints.
// Leaves one identified snippet in the local database (there is no delete endpoint yet).
describe('SNI-35 / real local backend', () => {
  it('loads the catalog, creates an uploaded snippet, searches and renders on desktop/mobile', () => {
    const name = 'SNI-35-browser-' + Date.now() + '.example';
    const missing = 'SNI35-no-match-' + Date.now();
    const code = 'println(35);\r\n';
    cy.viewport(1440, 1000);
    cy.intercept('GET', '/api/languages').as('catalog');
    cy.intercept('GET', '/api/snippets?*', request => {
      if (request.query.name === name) request.alias = 'matching';
      if (request.query.name === missing) request.alias = 'empty';
    }).as('list');
    cy.intercept('POST', '/api/snippets').as('create');
    cy.visit('/');
    cy.wait('@list').its('response.statusCode').should('eq', 200);
    cy.wait('@catalog').then(({response}) => {
      expect(response?.statusCode).to.eq(200);
      expect(response?.body).to.deep.include({language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']});
    });
    cy.get('[data-testid="upload-file-input"]').selectFile({
      contents: Cypress.Buffer.from(code), fileName: name + '.PRS',
    }, {force: true});
    cy.get('#name').should('have.value', name);
    cy.get('#version').click(); cy.get('[role="option"]').contains('1.1').click();
    cy.screenshot('sni35-upload-desktop', {capture: 'viewport'});
    cy.get('[data-testid="save-snippet"]').click();
    cy.wait('@create').then(({request, response}) => {
      expect(request.body.code).to.eq(code);
      expect(request.body.version).to.eq('1.1');
      expect(request.headers['idempotency-key']).to.match(/^[0-9a-f-]{36}$/);
      expect(response?.statusCode).to.eq(201);
      cy.writeFile('cypress/screenshots/sni35-created.json', {id: response?.body.id, name});
    });
    cy.get('[role="dialog"]').should('not.exist');
    cy.wait('@list').its('response.statusCode').should('eq', 200);
    cy.get('input[placeholder="Nombre del snippet…"]').type(name);
    cy.wait('@matching').then(({response}) => {
      expect(response?.body.count).to.eq(1);
      expect(response?.body.snippets[0].name).to.eq(name);
    });
    cy.get('[data-testid="snippet-row"]').should('have.length', 1);
    cy.screenshot('sni35-desktop', {capture: 'viewport'});
    cy.viewport(390, 844);
    cy.get('body').then(body => expect(body[0].scrollWidth).to.be.at.most(390));
    cy.contains('button', name).should('be.visible');
    cy.screenshot('sni35-mobile', {capture: 'viewport'});
    cy.get('input[placeholder="Nombre del snippet…"]').clear().type(missing);
    cy.wait('@empty').its('response.body.count').should('eq', 0);
    cy.contains('No encontramos coincidencias').should('be.visible');
    cy.screenshot('sni35-empty-mobile', {capture: 'viewport'});
    cy.contains('button', 'Limpiar filtros').click();
    cy.wait('@list').its('response.statusCode').should('eq', 200);
  });
});

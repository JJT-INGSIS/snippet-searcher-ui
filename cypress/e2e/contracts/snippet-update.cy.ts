const id = '0f8b3c1e-4a2d-4d3b-9b7a-2c6e5f1a9d40';
const metadata = {id, name: 'Hello', description: null, language: 'printscript', version: '1.0'};
const descriptor = {...metadata, extension: 'prs', ownerId: 'dev-juan', relation: 'owned',
  lint: {status: 'pending', reason: 'NOT_EVALUATED', diagnostics: [], codeHash: null, rulesRevision: null, processorRevision: null}};
const detail = {...descriptor, code: 'println(1);', capabilities: {modify: true, share: true}};
const catalog = [
  {language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']},
  {language: 'otherscript', extension: 'ots', versions: ['2.0']},
];

function openDetail(readonly = false) {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}});
  cy.intercept('GET', '/api/languages', catalog).as('catalog');
  cy.intercept('GET', '/api/snippets?*', {page: 0, page_size: 10, count: 1, snippets: [descriptor]}).as('list');
  cy.intercept('GET', '/api/snippets/' + id, readonly
    ? {...detail, relation: 'shared', capabilities: {modify: false, share: false}} : detail).as('detail');
  cy.visit('/'); cy.wait('@list');
  cy.get('[data-testid="snippet-row"] button').click(); cy.wait('@detail'); cy.wait('@catalog');
}
function replaceWithFile(contents: string, fileName: string) {
  cy.get('[data-testid="replace-file-input"]').selectFile({contents: Cypress.Buffer.from(contents), fileName}, {force: true});
}
function expectUpdate(body: Record<string, unknown>) {
  cy.intercept('PUT', '/api/snippets/' + id, req => {
    expect(req.body).to.deep.eq(body);
    req.reply(200, {...metadata, name: body.name, language: body.language, version: body.version});
  }).as('update');
}

describe('SNI-91 updating an existing snippet by file or editor', () => {
  it('replaces only the code from a file and saves the same snippet', () => {
    openDetail();
    replaceWithFile('println(5);', 'otro-nombre.prs');
    cy.get('#detail-code').should('have.value', 'println(5);');
    cy.get('#detail-name').should('have.value', 'Hello');
    expectUpdate({name: 'Hello', description: null, language: 'printscript', version: '1.0', code: 'println(5);'});
    cy.get('[data-testid="save-changes"]').click(); cy.wait('@update');
    cy.contains('Cambios guardados.').scrollIntoView().should('be.visible');
  });

  it('updates metadata, language and version from the editor', () => {
    openDetail();
    cy.get('#detail-name').clear().type('Hello v2');
    cy.get('#detail-version').click(); cy.get('[role="option"]').contains('1.1').click();
    cy.get('#detail-code').clear().type('println(2);');
    expectUpdate({name: 'Hello v2', description: null, language: 'printscript', version: '1.1', code: 'println(2);'});
    cy.get('[data-testid="save-changes"]').click(); cy.wait('@update');
    cy.contains('Cambios guardados.').scrollIntoView().should('be.visible');
  });

  it('asks for a version when the language changes, by selection or by file', () => {
    openDetail();
    cy.get('#detail-language').click(); cy.get('[role="option"]').contains('otherscript').click();
    cy.get('[data-testid="save-changes"]').should('be.disabled');
    cy.get('#detail-language').click(); cy.get('[role="option"]').contains('printscript').click();
    replaceWithFile('print 5', 'nuevo.ots');
    cy.get('#detail-code').should('have.value', 'print 5');
    cy.get('[data-testid="save-changes"]').should('be.disabled');
    cy.get('#detail-version').click(); cy.get('[role="option"]').contains('2.0').click();
    expectUpdate({name: 'Hello', description: null, language: 'otherscript', version: '2.0', code: 'print 5'});
    cy.get('[data-testid="save-changes"]').should('be.enabled').click(); cy.wait('@update');
  });

  it('keeps the draft and shows parser diagnostics when the replacement is invalid', () => {
    openDetail();
    cy.intercept('PUT', '/api/snippets/' + id, {statusCode: 422, body: {
      type: 'urn:snippets:problem:invalid-code', status: 422,
      diagnostics: [{rule: 'UNEXPECTED_TOKEN', message: 'Expected identifier', line: 2, column: 5}],
    }}).as('invalid');
    replaceWithFile('let : number = 1;', 'roto.prs');
    cy.get('[data-testid="save-changes"]').click(); cy.wait('@invalid');
    cy.contains('UNEXPECTED_TOKEN: Expected identifier (2:5)').scrollIntoView().should('be.visible');
    cy.get('#detail-code').should('have.value', 'let : number = 1;').and('not.have.attr', 'readonly');
    cy.contains('Cambios guardados.').should('not.exist');
  });

  it('keeps the draft when the file cannot be used', () => {
    openDetail();
    cy.get('#detail-code').clear().type('println(3);');
    replaceWithFile(' \t\r\n', 'vacio.prs');
    cy.contains('vacío').should('be.visible');
    cy.get('#detail-code').should('have.value', 'println(3);');
  });

  it('offers no replacement to a reader with read-only access', () => {
    openDetail(true);
    cy.get('[data-testid="replace-file-input"]').should('not.exist');
    cy.contains('button', 'Reemplazar desde archivo').should('not.exist');
    cy.get('#detail-language').should('have.class', 'Mui-disabled');
    cy.get('[data-testid="save-changes"]').should('be.disabled');
  });
});

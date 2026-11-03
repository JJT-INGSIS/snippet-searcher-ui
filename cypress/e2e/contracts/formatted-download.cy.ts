const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const ORIGINAL = 'let saludo:string="¡Hola, señor! 🚀";\nprintln(saludo);';
const FORMATTED = 'let saludo: string = "¡Hola, señor! 🚀";\nprintln(saludo);\n';
const DELAY_MS = 300;
const descriptor = {
  id: snippetId, name: 'Saludo', description: null, language: 'printscript', version: '1.1', extension: 'prs',
  ownerId: 'dev-thiago', relation: 'owned', lint: {status: 'not-implemented'},
};
const formatted = {
  snippetId, name: 'Saludo', language: 'printscript', version: '1.1', extension: 'prs', code: FORMATTED,
  source: 'stored', rulesRevision: 'sha256-v1:' + 'a'.repeat(64), processorRevision: 'sha256-v1:' + 'e'.repeat(64),
};
const downloads = Cypress.config('downloadsFolder');

function setup(actor = 'dev-thiago', readonly = false) {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: actor}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]);
  cy.intercept('GET', '/api/snippets?*', {page: 0, page_size: 10, count: 1, snippets: [descriptor]}).as('list');
  cy.intercept('GET', '/api/snippets/' + snippetId, {
    ...descriptor, code: ORIGINAL, relation: readonly ? 'shared' : 'owned', capabilities: {modify: !readonly, share: !readonly},
  }).as('detail');
}
function openDetail() {
  cy.visit('/', {onBeforeLoad: win => {cy.spy(win.URL, 'createObjectURL').as('create'); cy.spy(win.URL, 'revokeObjectURL').as('revoke');}});
  cy.wait('@list');
  cy.contains('button', 'Saludo').click(); cy.wait('@detail');
}
function downloadFormatted() {cy.get('[data-testid="download-formatted"]').click();}

describe('SNI-66 formatted download from the detail', () => {
  it('asks only on click and saves the formatted code with its name extension and unicode', () => {
    setup();
    cy.intercept('GET', '/api/snippets/' + snippetId + '/formatted', req => {
      expect(req.headers['x-dev-actor-id']).to.eq('dev-thiago');
      req.reply({delay: DELAY_MS, body: formatted});
    }).as('formatted');
    openDetail();
    cy.get('@formatted.all').should('have.length', 0);

    downloadFormatted();
    cy.get('[data-testid="download-formatted"]').should('be.disabled').and('contain.text', 'Preparando…');
    cy.wait('@formatted');

    cy.readFile(downloads + '/Saludo-formateado.prs', 'utf8').should('eq', FORMATTED);
    cy.get('[data-testid="download-formatted"]').should('be.enabled').and('contain.text', 'Descargar formateado');
    cy.get('@revoke').should('have.been.called');
    cy.get('@formatted.all').should('have.length', 1);
    cy.screenshot('sni66-detail-downloads', {capture: 'viewport'});
  });

  it('a reader downloads the formatted variant of a shared snippet', () => {
    setup('dev-ana', true);
    cy.intercept('GET', '/api/snippets/' + snippetId + '/formatted', req => {
      expect(req.headers['x-dev-actor-id']).to.eq('dev-ana');
      req.reply(formatted);
    }).as('formatted');
    openDetail();
    cy.contains('Solo lectura').should('be.visible');

    downloadFormatted(); cy.wait('@formatted');

    cy.readFile(downloads + '/Saludo-formateado.prs', 'utf8').should('eq', FORMATTED);
  });

  it('shows why the variant is not ready, never retries it and keeps the original download working', () => {
    setup();
    let attempts = 0;
    cy.intercept('GET', '/api/snippets/' + snippetId + '/formatted', req => {
      attempts++;
      req.reply(409, {type: 'urn:snippets:problem:formatting-stale', status: 409});
    }).as('formatted');
    openDetail();

    downloadFormatted(); cy.wait('@formatted');

    cy.contains('El snippet cambió mientras se preparaba').should('be.visible');
    cy.wait(DELAY_MS).then(() => expect(attempts).to.eq(1));
    cy.contains('a', 'Descargar original').click();
    cy.readFile(downloads + '/Saludo.prs', 'utf8').should('eq', ORIGINAL);
  });

  it('lists the diagnostics of code that cannot be formatted', () => {
    setup();
    cy.intercept('GET', '/api/snippets/' + snippetId + '/formatted', {
      statusCode: 422,
      body: {type: 'urn:snippets:problem:unformattable-code', status: 422,
        diagnostics: [{rule: 'UNTERMINATED_STRING', message: 'falta cerrar el texto', line: 1, column: 9}]},
    }).as('formatted');
    openDetail();

    downloadFormatted(); cy.wait('@formatted');

    cy.contains('El código tiene errores que impiden formatearlo').should('be.visible');
    cy.contains('UNTERMINATED_STRING: falta cerrar el texto (1:9)').should('be.visible');
  });

  it('warns that downloads use the saved version while there are unsaved changes', () => {
    setup(); openDetail();
    cy.contains('tus cambios sin guardar no se incluyen').should('not.exist');

    cy.get('#detail-name').type(' editado');

    cy.contains('Las descargas usan la versión guardada: tus cambios sin guardar no se incluyen.').should('be.visible');
  });
});

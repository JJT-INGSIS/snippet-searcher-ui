// Only dev identity is supplied locally. Every API response comes from the real stack.
type Evidence = {ids: string[]; name: string; original: string};
const evidencePath = Cypress.env('SNI75_EVIDENCE');
const downloads = Cypress.config('downloadsFolder');
const actorHeader = (actor: string) => ({'X-Dev-Actor-Id': actor});

function visitAs(actorId: string, route = '/') {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId}});
  cy.visit(route, {onBeforeLoad: win => {
    cy.spy(win.URL, 'createObjectURL').as('createBlob');
    cy.spy(win.URL, 'revokeObjectURL').as('revokeBlob');
  }});
}

function download(evidence: Evidence, actor: string) {
  visitAs(actor);
  cy.get('input[placeholder="Nombre del snippet…"]').type(evidence.name);
  cy.contains('[data-testid="snippet-row"] button', evidence.name).click();
  cy.get('#detail-code').should('have.value', evidence.original);
  if (actor === 'dev-ana') cy.get('[data-testid="save-changes"]').should('be.disabled');
  cy.contains('a', 'Descargar original').click();
  cy.readFile(downloads + '/' + evidence.name + '.prs', 'utf8').should('eq', evidence.original);
  cy.intercept('GET', '/api/snippets/' + evidence.ids[0] + '/formatted').as('formatted');
  cy.get('[data-testid="download-formatted"]').click();
  cy.wait('@formatted').then(({response}) => {
    expect(response?.statusCode).to.eq(200);
    expect(response?.body.source).to.eq('stored');
    expect(response?.body.code).to.contain('¡Hola, señor! 🚀');
    expect(response?.body.code).not.to.eq(evidence.original);
    cy.readFile(downloads + '/' + evidence.name + '-formateado.prs', 'utf8').should('eq', response?.body.code);
  });
  cy.get('@createBlob').should('have.been.called');
  cy.get('@revokeBlob').should('have.been.called');
  cy.screenshot('sni75-download-' + actor, {capture: 'viewport'});
}

describe('SNI-75 / real formatting, progress and browser downloads', () => {
  before(() => {
    expect(new URL(Cypress.config('baseUrl') || '').hostname).to.be.oneOf(['127.0.0.1', 'localhost']);
    expect(evidencePath, 'run scripts/verify_sni75.py first and pass SNI75_EVIDENCE').to.be.a('string');
  });
  it('saves actual catalog rules, observes the batch and downloads as owner and reader', () => {
    cy.viewport(1440, 1000);
    cy.readFile(evidencePath).then((evidence: Evidence) => {
      visitAs('dev-thiago', '/rules');
      cy.get('#rules-version').should('not.have.attr', 'aria-disabled', 'true').click();
      cy.contains('[role="option"]', '1.1').click();
      cy.contains('label', 'mandatory-line-break-after-statement').find('input').click();
      cy.intercept('PUT', '/api/formatting-rules/printscript/1.1').as('save');
      cy.contains('button', /^Guardar$/).click();
      cy.wait('@save').then(({response}) => {
        expect(response?.statusCode).to.eq(200);
        expect(response?.body.changed).to.eq(true);
        expect(response?.body.jobId).to.be.a('string');
      });
      cy.contains('Reformateados:', {timeout: 300000}).should('be.visible');
      cy.screenshot('sni75-rules-completed', {capture: 'viewport'});
      download(evidence, 'dev-thiago');
      download(evidence, 'dev-ana');
      cy.request({url: '/api/snippets/' + evidence.ids[0] + '/formatted',
        headers: actorHeader('dev-bruno'), failOnStatusCode: false}).its('status').should('eq', 404);
    });
  });
});

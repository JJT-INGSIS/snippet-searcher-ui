// Only /app-config.json supplies the explicit dev actor. All API/provider replies are real.
const evidence = Cypress.env('SNI37_EVIDENCE_FILE');
const phase = Cypress.env('SNI37_PHASE') || 'healthy';
function visitAs(actorId: string, path = '/') {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId}});
  cy.intercept('GET', '/api/snippets?*').as('list');
  cy.visit(path);
}
function search(prefix: string) {
  cy.get('input[placeholder="Nombre del snippet…"]').clear().type(prefix);
  cy.wait('@list');
  cy.get('[data-testid="snippet-row"]').should('have.length.greaterThan', 0);
}
function open(id: string) {
  cy.intercept('GET', '/api/snippets/' + id).as('detail');
  cy.get('[data-testid="snippet-row"] button').then(buttons => {
    // Names and IDs are read from the actual API evidence, never manufactured responses.
    cy.readFile(evidence).then(record => {
      const name = record.fixtures.details[id].name;
      expect([...buttons].some(button => button.textContent === name)).to.eq(true);
      cy.contains('[data-testid="snippet-row"] button', name).click();
    });
  });
  cy.wait('@detail').its('response.statusCode').should('eq', 200);
}
function section() {return cy.get('[data-testid="lint-section"]').scrollIntoView();}

describe('SNI-37 real lint and test acceptance', () => {
  before(() => {
    expect(new URL(Cypress.config('baseUrl') || '').hostname).to.be.oneOf(['localhost', '127.0.0.1']);
    expect(evidence).to.be.a('string').and.not.be.empty;
  });
  (phase === 'healthy' ? it : it.skip)('shows real states, diagnostics, paginated counts and read-only shared tests', () => {
    cy.viewport(1440, 1000);
    cy.readFile(evidence).then(record => {
      const details = Object.values(record.fixtures.details) as {id: string; name: string; lint: {status: string; reason: string; diagnostics: {rule: string; message: string; line: number; column: number}[]}}[];
      const prefix = details[0].name.slice(0, details[0].name.lastIndexOf('-') + 1);
      const bad = details.find(row => row.lint.status === 'not-compliant')!;
      visitAs('dev-ana'); cy.wait('@list'); search(prefix);
      cy.contains('label', 'Ordenar por').parent().click(); cy.contains('[role="option"]', /^Lint$/).click(); cy.wait('@list');
      cy.get('.MuiTablePagination-select[role="combobox"]').click(); cy.contains('[role="option"]', /^5$/).click(); cy.wait('@list');
      cy.get('[data-testid="snippet-row"]').should('have.length', 5);
      cy.contains('1–5 de 8').should('be.visible');
      cy.get('[aria-label="Página siguiente"]').click(); cy.wait('@list');
      cy.get('[data-testid="snippet-row"]').should('have.length', 3);
      cy.contains('6–8 de 8').should('be.visible');
      ['Con infracciones', 'Desactualizado'].forEach(label => cy.get('[data-testid="snippet-row"]').contains(label).should('be.visible'));
      cy.screenshot('sni37-reader-pages-and-states', {capture: 'viewport'});
      cy.get('#lint-filter').click(); cy.contains('[role="option"]', 'Con infracciones').click(); cy.wait('@list');
      cy.get('[data-testid="snippet-row"]').should('have.length', 1);
      open(bad.id);
      section().within(() => {
        cy.contains('Con infracciones').should('be.visible');
        cy.contains('Evaluado con las reglas del propietario.').should('be.visible');
        bad.lint.diagnostics.forEach(d => cy.contains(d.rule + ': ' + d.message + ' (' + d.line + ':' + d.column + ')').should('be.visible'));
      });
      cy.get('#detail-code').should('have.value', 'println(1+2);').and('have.attr', 'readonly');
      cy.get('[data-testid="save-changes"]').should('be.disabled');
      cy.contains('button', /^Compartir$/).should('be.disabled');
      cy.contains('button', /^Ver tests$/).click();
      cy.contains('Solo lectura: podés consultar tests.').should('be.visible');
      cy.get('#test-tab-new').should('not.exist');
      cy.contains('button', /^Ejecutar test$/).click();
      cy.contains('Test aprobado: los outputs coinciden exactamente.', {timeout: 15000}).scrollIntoView().should('be.visible');
      cy.screenshot('sni37-reader-test-passed-not-lint', {capture: 'viewport'});
    });
  });
  (phase === 'healthy' ? it : it.skip)('distinguishes superseded and failed states, and preserves the owner draft', () => {
    cy.readFile(evidence).then(record => {
      const details = Object.values(record.fixtures.details) as {id: string; name: string; ownerId: string; code: string; lint: {status: string}}[];
      const pending = details.find(row => row.lint.status === 'pending')!;
      visitAs('dev-ana'); cy.wait('@list'); search(pending.name); open(pending.id);
      section().contains('Desactualizado').should('be.visible');
      cy.get('[aria-label="Infracciones de lint"]').should('not.exist');
      cy.get('#detail-code').type('\nprintln(9);', {parseSpecialCharSequences: false});
      section().contains('tus cambios sin guardar se evalúan al guardarlos').should('be.visible');
      cy.get('#detail-code').should('have.value', pending.code + '\nprintln(9);');
      cy.screenshot('sni37-superseded-draft', {capture: 'viewport'});
      const failed = details.find(row => row.lint.status === 'failed')!;
      visitAs('dev-ana'); cy.wait('@list'); search(failed.name); open(failed.id);
      section().contains('No se pudo evaluar').should('be.visible');
      section().contains('problema técnico').should('be.visible');
      cy.get('[aria-label="Infracciones de lint"]').should('not.exist');
      cy.screenshot('sni37-technical-failure', {capture: 'viewport'});
      const bad = details.find(row => row.lint.status === 'not-compliant')!;
      visitAs('dev-bruno'); cy.wait('@list');
      cy.get('input[placeholder="Nombre del snippet…"]').type(bad.name);
      cy.contains('No encontramos coincidencias').should('be.visible');
      cy.request({url: '/api/snippets/' + bad.id, headers: {'X-Dev-Actor-Id': 'dev-bruno'}, failOnStatusCode: false}).its('status').should('eq', 404);
    });
  });
  (phase === 'batch' ? it : it.skip)('saves real lint rules, observes the batch and edits an owned snippet', () => {
    const path = Cypress.env('SNI37_BATCH_FILE');
    cy.readFile(path).then(record => {
      visitAs(record.prepare.owner, '/rules');
      cy.contains('[role="tab"]', 'Lint').click();
      cy.get('#lint-rules-version').click(); cy.contains('[role="option"]', '1.1').click();
      cy.get('[data-testid="lint-rule-mandatory-variable-or-literal-in-println"] input[type="checkbox"]').check();
      cy.intercept('PUT', '/api/linting-rules/printscript/1.1').as('saveRules');
      cy.get('#rules-panel-lint').contains('button', /^Guardar$/).click();
      cy.wait('@saveRules').then(({response}) => {
        expect(response?.statusCode).to.eq(200);
        expect(response?.body.changed).to.eq(true);
        expect(response?.body.jobId).to.be.a('string');
      });
      cy.contains('Evaluados: 12 snippets.', {timeout: 30000}).should('be.visible');
      cy.screenshot('sni37-real-rules-batch', {capture: 'viewport'});
      cy.get('#rules-panel-lint').contains('button', /^Guardar$/).should('be.disabled');
      visitAs(record.prepare.owner); cy.wait('@list'); search(record.prepare.prefix + '-0');
      cy.contains('[data-testid="snippet-row"] button', record.prepare.prefix + '-0').click();
      cy.get('#detail-code').should('have.value', 'println(1+2);').clear().type('println(1);', {parseSpecialCharSequences: false});
      section().contains('tus cambios sin guardar se evalúan al guardarlos').should('be.visible');
      cy.intercept('PUT', '/api/snippets/*').as('saveCode');
      cy.get('[data-testid="save-changes"]').click(); cy.wait('@saveCode').its('response.statusCode').should('eq', 200);
      cy.contains('Cambios guardados.').should('be.visible');
      section().contains('Sin infracciones').should('be.visible');
      cy.get('#detail-code').should('have.value', 'println(1);');
      cy.screenshot('sni37-owner-edited-lint', {capture: 'viewport'});
    });
  });
  (phase === 'processor-down' || phase === 'permissions-down' ? it : it.skip)('reports the actual dependency outage without an empty or compliant list', () => {
    visitAs('dev-ana'); cy.wait('@list').its('response.statusCode').should('eq', 502);
    cy.contains('No pudimos comunicarnos con un servicio necesario.').should('be.visible');
    cy.contains('No encontramos coincidencias').should('not.exist');
    cy.get('[data-testid="snippet-row"]').should('not.exist');
    cy.screenshot('sni37-' + phase, {capture: 'viewport'});
  });
  (phase === 'storage-down' ? it : it.skip)('keeps the list but reports an actual content failure', () => {
    cy.readFile(evidence).then(record => {
      const bad = Object.values(record.fixtures.details).find((row: unknown) => (row as {lint: {status: string}}).lint.status === 'not-compliant') as {id: string; name: string};
      visitAs('dev-ana'); cy.wait('@list').its('response.statusCode').should('eq', 200); search(bad.name);
      cy.contains('[data-testid="snippet-row"] button', bad.name).click();
      cy.contains('No pudimos acceder al contenido.').should('be.visible');
      cy.get('#detail-code').should('not.exist');
      cy.screenshot('sni37-storage-down', {capture: 'viewport'});
    });
  });
});

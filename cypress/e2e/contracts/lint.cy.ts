const actor = 'dev-juan';
const jobId = '990e8400-e29b-41d4-a716-446655440010';
const ownedId = '0f8b3c1e-4a2d-4d3b-9b7a-2c6e5f1a9d40';
const sharedId = '7d2e9a4f-1b3c-4e5d-8f6a-0b1c2d3e4f50';
const REVISION_LENGTH = 64;
const revision = (digit: string) => 'sha256-v1:' + digit.repeat(REVISION_LENGTH);
const println = {
  id: 'mandatory-variable-or-literal-in-println', type: 'boolean', acceptsNull: true, choices: [], conflictsWith: [], value: true,
};
const identifier = {
  id: 'identifier_format', type: 'choice', acceptsNull: true, choices: ['camel case', 'snake case'], conflictsWith: [], value: 'camel case',
};
const lineLength = {id: 'max-line-length', type: 'integer', acceptsNull: true, choices: [], conflictsWith: [], value: null};
const lintRules = (identifierValue: string | null, length: number | null, changed = false, job: string | null = null, printlnValue = true) => ({
  language: 'printscript', version: '1.1', revision: revision(length === null ? 'a' : 'b'), changed, jobId: job,
  rules: [{...println, value: printlnValue}, {...identifier, value: identifierValue}, {...lineLength, value: length}],
});
const evaluated = {codeHash: revision('c'), rulesRevision: revision('a'), processorRevision: revision('e')};
const empty = {diagnostics: [], codeHash: null, rulesRevision: null, processorRevision: null};
const diagnostic = {rule: 'identifier_format', message: 'El identificador debe ser camel case', line: 1, column: 5};
const lints = {
  compliant: {status: 'compliant', reason: null, diagnostics: [], ...evaluated},
  violations: {status: 'not-compliant', reason: null, ...evaluated, diagnostics: [diagnostic]},
  superseded: {status: 'pending', reason: 'SUPERSEDED', ...empty},
  failed: {status: 'failed', reason: 'CODE_NOT_ANALYZABLE', ...empty},
};
const descriptor = (id: string, name: string, lint: object, relation = 'owned') => ({
  id, name, description: null, language: 'printscript', version: '1.1', extension: 'prs',
  ownerId: relation === 'owned' ? actor : 'dev-thiago', relation, lint,
});
const progress = (status: string, processed: number, pending: number) =>
  ({id: jobId, status, processed, failed: 0, pending, selectionComplete: true});

function config() {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: actor}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]);
}
function rulesSetup() {
  config();
  cy.intercept('GET', '/api/formatting-rules/printscript/1.0', {
    language: 'printscript', version: '1.0', revision: revision('f'), changed: false, jobId: null, rules: [],
  }).as('format-rules');
  cy.intercept('GET', '/api/linting-rules/printscript/1.0', {...lintRules('camel case', null), version: '1.0'}).as('lint-1.0');
  cy.intercept('GET', '/api/linting-rules/printscript/1.1', req => {
    expect(req.headers['x-dev-actor-id']).to.eq(actor);
    req.reply(lintRules('camel case', null));
  }).as('lint-1.1');
}
function openLintTab() {
  cy.visit('/rules'); cy.wait('@format-rules');
  cy.contains('[role="tab"]', 'Lint').click(); cy.wait('@lint-1.0');
  cy.get('#lint-rules-version').click(); cy.contains('[role="option"]', '1.1').click(); cy.wait('@lint-1.1');
}
function lintSection() {return cy.get('[data-testid="lint-section"]').scrollIntoView();}
function rule(id: string) {return cy.get('[data-testid="lint-rule-' + id + '"]');}
function save() {cy.get('#rules-panel-lint').contains('button', /^(Guardar|Reintentar guardado)$/).click();}

describe('SNI-67 lint configuration', () => {
  it('edits each rule type of the real catalog, saves the whole selection and follows the lint batch', () => {
    rulesSetup();
    cy.intercept('PUT', '/api/linting-rules/printscript/1.1', req => {
      expect(req.body).to.deep.eq({rules: {
        'mandatory-variable-or-literal-in-println': false, identifier_format: 'snake case', 'max-line-length': 100,
      }});
      req.reply(lintRules('snake case', 100, true, jobId, false));
    }).as('save');
    let polls = 0;
    cy.intercept('GET', '/api/jobs/' + jobId, req => {
      req.reply(++polls === 1 ? progress('RUNNING', 1, 1) : progress('COMPLETED', 2, 0));
    }).as('job');
    openLintTab();
    cy.get('#rules-panel-lint').contains('button', /^Guardar$/).should('be.disabled');
    rule('mandatory-variable-or-literal-in-println').find('input[type="checkbox"]').click();
    cy.get('#lint-rule-identifier_format-value').click(); cy.contains('[role="option"]', 'snake case').click();
    cy.get('#lint-rule-max-line-length-value').type('1.5');
    cy.get('#rules-panel-lint').contains('button', /^Guardar$/).should('be.disabled');
    cy.get('#lint-rule-max-line-length-value').clear().type('100');
    save(); cy.wait('@save');
    cy.wait('@job');
    cy.contains('Evaluando lint de tus snippets').should('be.visible');
    cy.wait('@job');
    cy.contains('Evaluados: 2 snippets.').should('be.visible');
    cy.screenshot('sni67-lint-rules', {capture: 'viewport'});
  });

  it('marks the rules the server rejects, keeps the draft and retries only on request', () => {
    rulesSetup();
    let attempts = 0;
    cy.intercept('PUT', '/api/linting-rules/printscript/1.1', req => {
      if (++attempts === 1) {
        req.reply(422, {type: 'urn:snippets:problem:invalid-linting-rules', status: 422,
          violations: [{rule: 'max-line-length', reason: 'out-of-range'}]});
      } else req.reply(lintRules('camel case', 9999, false, null));
    }).as('save');
    openLintTab();
    cy.get('#lint-rule-max-line-length-value').type('9999');
    save(); cy.wait('@save');
    cy.contains('Reglas rechazadas: max-line-length').should('be.visible');
    rule('max-line-length').contains('El valor está fuera del rango permitido.').should('be.visible');
    cy.get('#lint-rule-max-line-length-value').should('have.value', '9999');
    cy.contains('button', 'Reintentar guardado').click(); cy.wait('@save');
    cy.contains('No hay nada para reevaluar').should('be.visible');
    cy.wrap(null).then(() => expect(attempts).to.eq(2));
  });

  it('keeps the formatting and lint scopes apart', () => {
    rulesSetup(); openLintTab();
    cy.get('#lint-rules-version').should('have.text', '1.1');
    cy.contains('[role="tab"]', 'Formato').click();
    cy.get('#rules-version').should('have.text', '1.0');
  });
});

describe('SNI-67 compliance in listing and detail', () => {
  function listing(snippets: object[]) {
    config();
    cy.intercept('GET', '/api/snippets?*', req => {
      req.reply({page: Number(req.query.page), page_size: Number(req.query.page_size), count: snippets.length, snippets});
    }).as('list');
    cy.visit('/'); cy.wait('@list');
  }

  it('shows every real state and filters or sorts by lint only when asked', () => {
    listing([
      descriptor(ownedId, 'Limpio', lints.compliant), descriptor(sharedId, 'Con errores', lints.violations, 'shared'),
      descriptor('1c6b59b7-007f-4287-b8f4-e60287d3505a', 'Viejo', lints.superseded),
      descriptor('81fd0055-ab43-430d-a883-8e9772f32ebc', 'Roto', lints.failed),
    ]);
    ['Sin infracciones', 'Con infracciones', 'Desactualizado', 'No se pudo evaluar'].forEach(label =>
      cy.get('[data-testid="snippet-row"]').contains(label).should('be.visible'));
    cy.get('[aria-label="Página siguiente"]').should('exist');
    cy.get('#lint-filter').click(); cy.contains('[role="option"]', 'Con infracciones').click();
    cy.wait('@list').its('request.query').should('include', {page: '0', lint: 'not-compliant'});
    cy.contains('label', 'Ordenar por').parent().click(); cy.contains('[role="option"]', /^Lint$/).click();
    cy.wait('@list').its('request.query').should('include', {sort: 'lint', lint: 'not-compliant'});
    cy.get('#lint-filter').click(); cy.contains('[role="option"]', 'Todos').click();
    cy.wait('@list').its('request.query').should('not.have.property', 'lint');
  });

  it('shows an unverifiable linter as an error and never as an empty or clean list', () => {
    config();
    cy.intercept('GET', '/api/snippets?*', {statusCode: 502, body: {type: 'urn:snippets:problem:dependency-failure', status: 502}}).as('list');
    cy.visit('/'); cy.wait('@list');
    cy.contains('No pudimos comunicarnos con un servicio necesario').should('be.visible');
    cy.contains('Sin infracciones').should('not.exist');
  });

  it('lists the diagnostics of the saved version and explains shared and unsaved results', () => {
    listing([descriptor(sharedId, 'Con errores', lints.violations, 'shared')]);
    cy.intercept('GET', '/api/snippets/' + sharedId, {
      ...descriptor(sharedId, 'Con errores', lints.violations, 'shared'), code: 'let Bad_name: number = 1;',
      capabilities: {modify: false, share: false},
    }).as('detail');
    cy.contains('button', 'Con errores').click(); cy.wait('@detail');
    lintSection().within(() => {
      cy.contains('Con infracciones').should('be.visible');
      cy.contains('identifier_format: El identificador debe ser camel case (1:5)').should('be.visible');
      cy.contains('Evaluado con las reglas del propietario.').should('be.visible');
    });
  });

  it('explains a superseded or failed result without inventing violations and warns about unsaved changes', () => {
    listing([descriptor(ownedId, 'Viejo', lints.superseded), descriptor(sharedId, 'Roto', lints.failed)]);
    cy.intercept('GET', '/api/snippets/' + ownedId, {
      ...descriptor(ownedId, 'Viejo', lints.superseded), code: 'println(1);', capabilities: {modify: true, share: true},
    }).as('superseded');
    cy.intercept('GET', '/api/snippets/' + sharedId, {
      ...descriptor(sharedId, 'Roto', lints.failed), code: 'println(2);', capabilities: {modify: true, share: true},
    }).as('failed');
    cy.contains('button', 'Viejo').click(); cy.wait('@superseded');
    lintSection().contains('se está reevaluando').should('be.visible');
    cy.get('[aria-label="Infracciones de lint"]').should('not.exist');
    cy.get('#detail-name').type(' editado');
    lintSection().contains('tus cambios sin guardar se evalúan al guardarlos').should('be.visible');
    cy.get('[aria-label="Cerrar detalle"]').click();
    cy.contains('button', 'Roto').click(); cy.wait('@failed');
    lintSection().contains('errores que impiden analizarlo').should('be.visible');
  });
});

const actor = 'dev-juan';
const LONGER_THAN_ONE_POLL_MS = 3500;
const SETTLE_MS = 500;
const REVISION_LENGTH = 64;
const firstJob = '990e8400-e29b-41d4-a716-446655440000';
const secondJob = '990e8400-e29b-41d4-a716-446655440001';
const revision = (digit: string) => 'sha256-v1:' + digit.repeat(REVISION_LENGTH);
const colonRule = {id: 'space-before-colon', type: 'boolean', default: false, minimum: null, maximum: null,
  conflictsWith: ['space-after-colon'], description: 'Agrega un espacio antes de los dos puntos.'};
const printlnRule = {id: 'line-breaks-before-println', type: 'integer', default: 0, minimum: 0, maximum: 2,
  conflictsWith: [], description: 'Saltos de línea antes de cada println.'};
const rules = (version: string, colon: boolean, println: number | null, changed = false, jobId: string | null = null) => ({
  language: 'printscript', version, revision: revision(println === null ? 'a' : 'b'), changed, jobId,
  rules: [{...colonRule, value: colon}, {...printlnRule, value: println}],
});
const progress = (id: string, status: string, processed: number, pending: number, selectionComplete = true) =>
  ({id, status, processed, failed: 0, pending, selectionComplete});

function setup() {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: actor}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]);
  cy.intercept('GET', '/api/formatting-rules/printscript/1.0', req => {
    expect(req.headers['x-dev-actor-id']).to.eq(actor);
    req.reply(rules('1.0', false, null));
  }).as('rules-1.0');
  cy.intercept('GET', '/api/formatting-rules/printscript/1.1', rules('1.1', true, 1)).as('rules-1.1');
  cy.intercept('GET', '/api/linting-rules/*/*', req => {
    const [language, version] = new URL(req.url).pathname.split('/').slice(-2);
    req.reply({language, version, revision: revision('d'), changed: false, jobId: null, rules: []});
  });
}
function visit() {cy.visit('/rules'); cy.wait('@rules-1.0');}
function toggle(id: string) {cy.contains('label', id).click();}
function numberOf(id: string) {return cy.get('#rule-' + id + '-value');}
function save() {cy.contains('button', /^(Guardar|Reintentar guardado)$/).click();}

describe('SNI-65 formatting rules and reformatting progress', () => {
  it('edits the catalog, sends the full draft and polls the job until it finishes', () => {
    setup();
    cy.intercept('PUT', '/api/formatting-rules/printscript/1.0', req => {
      expect(req.headers['x-dev-actor-id']).to.eq(actor);
      expect(req.body).to.deep.eq({rules: {'space-before-colon': true, 'line-breaks-before-println': 2}});
      req.reply(rules('1.0', true, 2, true, firstJob));
    }).as('save');
    let polls = 0;
    cy.intercept('GET', '/api/jobs/' + firstJob, req => {
      expect(req.headers['x-dev-actor-id']).to.eq(actor);
      req.reply(++polls === 1 ? progress(firstJob, 'RUNNING', 1, 2) : progress(firstJob, 'COMPLETED', 3, 0));
    }).as('job');
    visit();
    cy.contains('button', /^Guardar$/).should('be.disabled');
    cy.contains('Saltos de línea antes de cada println.').should('be.visible');
    cy.contains('No se combina con: space-after-colon.').should('be.visible');
    toggle('space-before-colon'); toggle('line-breaks-before-println');
    numberOf('line-breaks-before-println').should('have.value', '0').clear().type('3');
    cy.contains('Entre 0 y 2.').should('be.visible');
    cy.contains('button', /^Guardar$/).should('be.disabled');
    numberOf('line-breaks-before-println').clear().type('2');
    save(); cy.wait('@save');
    cy.wait('@job');
    cy.contains('Reformateando tus snippets').should('be.visible');
    cy.contains('Listos: 1 snippet; pendientes: 2 snippets.').should('be.visible');
    cy.wait('@job');
    cy.contains('Reformateados: 3 snippets.').should('be.visible');
    cy.contains('button', /^Guardar$/).should('be.disabled');
    cy.wait(LONGER_THAN_ONE_POLL_MS).then(() => expect(polls).to.eq(2));
    cy.screenshot('sni65-reformatted', {capture: 'viewport'});
  });

  it('shows provider violations per rule, keeps the draft and retries only on request', () => {
    setup();
    let attempts = 0;
    cy.intercept('PUT', '/api/formatting-rules/printscript/1.0', req => {
      if (++attempts === 1) {
        req.reply(422, {type: 'urn:snippets:problem:invalid-formatting-rules', status: 422,
          violations: [{rule: 'space-before-colon', reason: 'conflicting-rules'}]});
      } else req.reply(rules('1.0', true, null, false, null));
    }).as('save');
    visit();
    toggle('space-before-colon');
    save(); cy.wait('@save');
    cy.contains('Algunas reglas no se pudieron guardar').should('be.visible');
    cy.contains('Reglas rechazadas: space-before-colon').should('be.visible');
    cy.contains('No se puede combinar con otra regla prendida.').should('be.visible');
    cy.contains('label', 'space-before-colon').find('input').should('be.checked');
    cy.wait(SETTLE_MS).then(() => expect(attempts).to.eq(1));
    cy.contains('button', 'Reintentar guardado').click(); cy.wait('@save');
    cy.contains('Las reglas ya tenían esos valores. No hay nada para reformatear.').should('be.visible');
    cy.contains('Reformateando tus snippets').should('not.exist');
  });

  it('asks before switching version with unsaved changes and keeps the draft across tabs', () => {
    setup(); visit();
    toggle('space-before-colon');
    cy.contains('[role="tab"]', 'Lint').click();
    cy.contains('Esta versión no tiene reglas de lint configurables.').should('be.visible');
    cy.contains('[role="tab"]', 'Formato').click();
    cy.contains('label', 'space-before-colon').find('input').should('be.checked');
    cy.get('#rules-version').click(); cy.contains('[role="option"]', '1.1').click();
    cy.contains('Cambios sin guardar').should('be.visible');
    cy.contains('button', 'Seguir editando').click();
    cy.get('#rules-version').should('have.text', '1.0');
    cy.contains('label', 'space-before-colon').find('input').should('be.checked');
    cy.get('#rules-version').click(); cy.contains('[role="option"]', '1.1').click();
    cy.contains('button', 'Descartar y cambiar').click(); cy.wait('@rules-1.1');
    numberOf('line-breaks-before-println').should('have.value', '1');
    cy.contains('button', 'Descartar cambios').should('be.disabled');
  });

  it('offers a manual refresh when progress cannot be read and resumes polling after it', () => {
    setup();
    cy.intercept('PUT', '/api/formatting-rules/printscript/1.0', rules('1.0', true, null, true, secondJob)).as('save');
    let polls = 0;
    cy.intercept('GET', '/api/jobs/' + secondJob, req => {
      polls++;
      if (polls === 1) req.reply(503, {type: 'urn:snippets:problem:metadata-unavailable', status: 503});
      else req.reply(polls === 2 ? progress(secondJob, 'RUNNING', 0, 0, false) : progress(secondJob, 'PARTIAL', 2, 0));
    }).as('job');
    visit();
    toggle('space-before-colon'); save(); cy.wait('@save'); cy.wait('@job');
    cy.contains('No pudimos consultar el progreso. Tus reglas ya quedaron guardadas.').should('be.visible');
    cy.wait(LONGER_THAN_ONE_POLL_MS).then(() => expect(polls).to.eq(1));
    cy.contains('button', 'Actualizar progreso').click(); cy.wait('@job');
    cy.contains('todavía buscando snippets').should('be.visible');
    cy.wait('@job');
    cy.contains('Terminó con fallos').should('be.visible');
  });
});

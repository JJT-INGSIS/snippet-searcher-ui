// Controlled HTTP contracts only. This does not certify the SNI-46 backend or permissions.
const first = '770e8400-e29b-41d4-a716-446655440000';
const second = '770e8400-e29b-41d4-a716-446655440001';
const testId = '880e8400-e29b-41d4-a716-446655440000';
const descriptor = (id: string, name: string) => ({
  id, name, description: null, language: 'printscript', version: '1.1', extension: 'prs',
  ownerId: 'dev-thiago', relation: 'owned', lint: {status: 'not-implemented'},
});
const definition = {id: testId, snippetId: first, inputs: ['', 'ñ', 'ñ'], expectedOutputs: ['expected', '', 'expected']};
function setup(readonly = false, actor = 'dev-thiago') {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: actor}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]);
  cy.intercept('GET', '/api/snippets?*', {page: 0, page_size: 10, count: 2, snippets: [descriptor(first, 'Primero'), descriptor(second, 'Segundo')]}).as('list');
  for (const [id, name] of [[first, 'Primero'], [second, 'Segundo']]) {
    cy.intercept('GET', '/api/snippets/' + id, {...descriptor(id, name), code: 'println(1);',
      relation: readonly ? 'shared' : 'owned', capabilities: {modify: !readonly, share: !readonly}}).as('detail-' + id);
  }
}
function visit() {cy.visit('/'); cy.wait('@list');}
function openTests(id = first, name = 'Primero') {
  cy.contains('button', name).click(); cy.wait('@detail-' + id);
  cy.contains('button', 'Ver tests').click();
}
function input(label: string) {return cy.get('[role="dialog"] textarea').filter('[id]').filter((_, element) =>
  element.getAttribute('aria-label') === label || element.ownerDocument.querySelector('label[for="' + element.id + '"]')?.textContent === label);
}

describe('SNI-50 scoped test definitions', () => {
  it('creates exact numbered values, keeps the draft on failure and closes only on success', () => {
    setup();
    let saved = false;
    cy.intercept('GET', '/api/snippets/' + first + '/tests', req => req.reply({items: saved ? [definition] : []})).as('tests');
    let attempts = 0;
    cy.intercept('POST', '/api/snippets/' + first + '/tests', req => {
      expect(req.headers['x-dev-actor-id']).to.eq('dev-thiago');
      expect(req.body).to.deep.eq({inputs: ['', 'ñ', 'ñ'], expectedOutputs: ['expected', '', 'expected']});
      if (++attempts === 1) req.reply(400, {type: 'urn:snippets:problem:invalid-request'});
      else {saved = true; req.reply(201, definition);}
    }).as('create-test');
    visit(); openTests(); cy.wait('@tests');
    cy.contains('Este snippet todavía no tiene tests.').should('be.visible');
    for (let index = 0; index < 3; index++) cy.contains('button', 'Agregar input').click();
    input('Input 2').type('ñ'); input('Input 3').type('ñ');
    for (let index = 0; index < 3; index++) cy.contains('button', 'Agregar output esperado').click();
    input('Output esperado 1').type('expected'); input('Output esperado 3').type('expected');
    cy.get('[data-testid="save-test"]').click(); cy.wait('@create-test');
    cy.contains('Revisá los campos indicados').should('be.visible');
    input('Input 2').should('have.value', 'ñ'); input('Input 3').should('have.value', 'ñ');
    cy.get('[data-testid="save-test"]').click(); cy.wait('@create-test');
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('button', 'Ver tests').click(); cy.wait('@tests');
    cy.contains('[role="tab"]', 'Test 1').should('be.visible');
    input('Input 1').should('have.value', ''); input('Input 2').should('have.value', 'ñ');
    cy.screenshot('sni50-saved-definition', {capture: 'viewport'});
  });
  it('lists shared tests read-only and allows execution without granting writes', () => {
    setup(true, 'dev-ana');
    cy.intercept('GET', '/api/snippets/' + first + '/tests', req => {
      expect(req.headers['x-dev-actor-id']).to.eq('dev-ana'); req.reply({items: [definition]});
    }).as('tests');
    visit(); openTests(); cy.wait('@tests');
    cy.contains('Solo lectura: podés consultar tests.').should('be.visible');
    cy.contains('[role="tab"]', 'Nuevo test').should('not.exist');
    cy.get('[data-testid="save-test"]').should('not.exist');
    input('Input 1').should('have.attr', 'readonly');
    cy.contains('button', /^Ejecutar test$/).should('be.enabled');
    for (const action of ['Editar test', 'Eliminar test']) cy.contains('button', new RegExp('^' + action + '$')).should('be.disabled');
  });
  it('distinguishes a failed list from an empty list and retries explicitly', () => {
    setup(); let attempts = 0;
    cy.intercept('GET', '/api/snippets/' + first + '/tests', req => {
      if (++attempts === 1) req.reply(503, {type: 'urn:snippets:problem:dependency-failure'});
      else req.reply({items: []});
    }).as('tests');
    visit(); openTests(); cy.wait('@tests');
    cy.contains('Este snippet todavía no tiene tests.').should('not.exist');
    cy.get('[data-testid="save-test"]').should('be.disabled');
    cy.contains('button', 'Reintentar listado de tests').click(); cy.wait('@tests');
    cy.contains('Este snippet todavía no tiene tests.').should('be.visible');
  });
  it('does not show cached tests or draft values from a different snippet', () => {
    setup();
    cy.intercept('GET', '/api/snippets/' + first + '/tests', {items: [definition]}).as('first-tests');
    cy.intercept('GET', '/api/snippets/' + second + '/tests', {delay: 300, body: {items: []}}).as('second-tests');
    visit(); openTests(); cy.wait('@first-tests');
    input('Output esperado 1').should('have.value', 'expected');
    cy.contains('[role="tab"]', 'Nuevo test').click(); cy.contains('button', 'Agregar input').click(); input('Input 1').type('private draft');
    cy.get('[aria-label="Cerrar diálogo"]').click(); cy.get('[aria-label="Cerrar detalle"]').click();
    openTests(second, 'Segundo');
    cy.get('[role="dialog"] textarea').should('not.exist');
    cy.wait('@second-tests');
    cy.contains('[role="tab"]', 'Test 1').should('not.exist');
    cy.get('[role="dialog"] textarea').should('not.exist');
    cy.contains('button', 'Agregar input').click(); input('Input 1').should('have.value', '');
  });
  it('keeps uncertain creation visible, does not repeat it automatically and warns about duplicates', () => {
    setup(); cy.intercept('GET', '/api/snippets/' + first + '/tests', {items: []}).as('tests');
    // Use an uncertain 5xx here: destroying Chromium's connection triggers transport
    // retries outside React Query. The Node HTTP contract test covers a lost socket.
    cy.intercept('POST', '/api/snippets/' + first + '/tests', {
      statusCode: 503, body: {type: 'urn:snippets:problem:dependency-failure'},
    }).as('create-test');
    visit(); openTests(); cy.wait('@tests');
    cy.get('[data-testid="save-test"]').click(); cy.wait('@create-test');
    cy.contains('No sabemos si el servidor guardó el test.').should('be.visible');
    cy.get('[data-testid="save-test"]').should('contain.text', 'puede duplicar');
    cy.get('@create-test.all').should('have.length', 1);
  });
  it('ignores a delayed test list after navigating to another snippet', () => {
    setup();
    cy.intercept('GET', '/api/snippets/' + first + '/tests', {delay: 1200, body: {items: [definition]}}).as('slow-tests');
    cy.intercept('GET', '/api/snippets/' + second + '/tests', {items: []}).as('current-tests');
    visit(); openTests();
    cy.get('@slow-tests.all').should('have.length', 1);
    cy.get('[aria-label="Cerrar diálogo"]').click(); cy.get('[aria-label="Cerrar detalle"]').click();
    openTests(second, 'Segundo'); cy.wait('@current-tests');
    // Give the original delayed response time to finish, if it was not aborted.
    cy.wait(1400);
    cy.contains('Este snippet todavía no tiene tests.').should('be.visible');
    cy.contains('[role="tab"]', 'Test 1').should('not.exist');
  });
  it('removes just the selected row and retains duplicate and empty neighbors', () => {
    setup(); cy.intercept('GET', '/api/snippets/' + first + '/tests', {items: []}).as('tests');
    cy.intercept('POST', '/api/snippets/' + first + '/tests', req => {
      expect(req.body).to.deep.eq({inputs: ['same', ''], expectedOutputs: []});
      req.reply(201, {id: testId, snippetId: first, ...req.body});
    }).as('create-test');
    visit(); openTests(); cy.wait('@tests');
    for (let index = 0; index < 3; index++) cy.contains('button', 'Agregar input').click();
    input('Input 1').type('same'); input('Input 2').type('same');
    cy.get('[aria-label="Quitar input 1"]').click();
    input('Input 1').should('have.value', 'same'); input('Input 2').should('have.value', '');
    cy.get('[data-testid="save-test"]').click(); cy.wait('@create-test');
  });
  it('keeps numbered fields usable on mobile and restores focus when dismissed', () => {
    setup(); cy.viewport(390, 844);
    cy.intercept('GET', '/api/snippets/' + first + '/tests', {items: []}).as('tests');
    visit(); openTests(); cy.wait('@tests');
    cy.contains('button', 'Agregar output esperado').click();
    input('Output esperado 1').type('Texto largo con Unicode: ñ y espacios');
    cy.get('[role="dialog"]').then(dialog => {
      expect(dialog[0].scrollWidth).to.be.at.most(dialog[0].clientWidth + 1);
    });
    cy.screenshot('sni50-mobile-editor', {capture: 'viewport'});
    input('Output esperado 1').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('button', 'Ver tests').should('have.focus');
  });
});

// UI contract fixtures only. Real HTTP incremental delivery is tested in Vitest;
// real Snippets + interpreter acceptance belongs to SNI-53.
const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const secondId = '770e8400-e29b-41d4-a716-446655440001';
const testId = '880e8400-e29b-41d4-a716-446655440000';
const executionId = '550e8400-e29b-41d4-a716-446655440000';
const requestId = '660e8400-e29b-41d4-a716-446655440000';
const metadata = (id: string, name: string) => ({id, name, description: null, language: 'printscript', version: '1.1',
  extension: 'prs', ownerId: 'dev-thiago', relation: 'owned', lint: {status: 'not-implemented'}});
const descriptor = (test = false) => ({executionId, snippetId, ...(test ? {testId} : {}), mode: test ? 'TEST' : 'INTERACTIVE',
  state: 'STARTING', lastSeq: 0, snapshot: {language: 'printscript', version: '1.1', codeHash: 'sha256-v1:' + 'a'.repeat(64), ...(test ? {testHash: 'sha256-v1:' + 'b'.repeat(64)} : {})},
  limits: {totalSeconds: 120, inputWaitSeconds: 30, reconnectSeconds: 15, codeBytes: 1048576, inputBytes: 8192, outputBytes: 1048576, bufferEvents: 256, bufferBytes: 262144, terminalRetentionSeconds: 60}});
const line = (seq: number, type: string, data: unknown) => JSON.stringify({executionId, seq, type, data}) + '\n';
const panel = () => cy.get('section[aria-label="Ejecución interactiva"]');
function setup() {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: 'dev-thiago'}});
  cy.intercept('GET', '/api/languages', [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}]);
  cy.intercept('GET', '/api/snippets?*', {page: 0, page_size: 10, count: 2, snippets: [metadata(snippetId, 'Primero'), metadata(secondId, 'Segundo')]}).as('list');
  for (const [id, name] of [[snippetId, 'Primero'], [secondId, 'Segundo']]) cy.intercept('GET', '/api/snippets/' + id,
    {...metadata(id, name), code: 'println(1);', capabilities: {modify: true, share: true}}).as('detail-' + id);
  cy.intercept('GET', '/api/snippets/' + snippetId + '/tests', {items: [{id: testId, snippetId, inputs: [], expectedOutputs: ['expected']}]}).as('tests');
}
function open() {cy.wait('@list'); cy.contains('button', 'Primero').click(); cy.wait('@detail-' + snippetId);}

// Browser-controlled stream allows asserting the DOM BEFORE emitting the terminal.
// All start/input/cancel calls still use the normal HTTP adapter and intercepts.
function controlledStream(initial: string) {
  const state: {controller?: ReadableStreamDefaultController<Uint8Array>} = {};
  const options = {onBeforeLoad(win: Window) {
    const original = win.fetch.bind(win);
    win.fetch = (input, init) => {
      if (String(input).includes('/executions/' + executionId + '/events?')) {
        const body = new ReadableStream<Uint8Array>({start(controller) {
          state.controller = controller; controller.enqueue(new TextEncoder().encode(initial));
        }});
        return Promise.resolve(new Response(body, {headers: {'Content-Type': 'application/x-ndjson'}}));
      }
      return original(input, init);
    };
  }};
  return {options, emit(text: string) {state.controller!.enqueue(new TextEncoder().encode(text));}, end(text: string) {
    state.controller!.enqueue(new TextEncoder().encode(text)); state.controller!.close();
  }};
}

describe('SNI-51 execution panels', () => {
  it('shows a saved test result and exact outputs in its existing modal', () => {
    setup();
    cy.intercept('POST', '/api/snippets/' + snippetId + '/tests/' + testId + '/executions', req => {
      expect(req.body).to.deep.eq({}); expect(req.headers['x-dev-actor-id']).to.eq('dev-thiago');
      req.reply(201, descriptor(true));
    }).as('start');
    cy.intercept('GET', '/api/executions/' + executionId + '/events?after=0', {headers: {'Content-Type': 'application/x-ndjson'},
      body: line(1, 'started', {mode: 'TEST'}) + line(2, 'output', {text: ''}) + line(3, 'output', {text: 'actual '}) +
        line(4, 'terminal', {outcome: 'COMPLETED', reason: 'program-completed', comparison: 'FAILED', unusedInputs: 0})});
    cy.visit('/'); open(); cy.contains('button', 'Ver tests').click(); cy.wait('@tests');
    cy.get('[role="dialog"]').within(() => {
      cy.contains('button', /^Ejecutar test$/).click(); cy.wait('@start');
      cy.contains('Test con diferencias respecto de los outputs esperados.').scrollIntoView().should('be.visible');
      cy.get('ol[aria-label="Output de ejecución"] li').should('have.length', 2).last().should('have.text', 'actual ');
    });
  });
  it('renders incremental output and submits an empty input for the current prompt without local echo', () => {
    setup();
    const channel = controlledStream(line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'output', {text: 'antes'}) + line(3, 'input-required', {requestId, prompt: 'Nombre?'}));
    cy.intercept('POST', '/api/snippets/' + snippetId + '/executions', {statusCode: 201, body: descriptor()}).as('start');
    cy.intercept('POST', '/api/executions/' + executionId + '/inputs', req => {
      expect(req.body).to.deep.eq({requestId, value: ''}); req.reply({requestId, accepted: true});
    }).as('input');
    cy.visit('/', channel.options); open();
    panel().within(() => {
      cy.contains('button', 'Ejecutar snippet').click(); cy.wait('@start');
      cy.get('ol li').should('have.text', 'antes'); cy.contains('Esperando input').should('be.visible');
      cy.contains('button', 'Enviar input').click(); cy.wait('@input');
      cy.contains('button', 'Enviar input').should('be.disabled');
      cy.get('ol li').should('have.length', 1);
    });
    cy.then(() => channel.end(line(4, 'input-accepted', {requestId}) + line(5, 'output', {text: ''}) + line(6, 'terminal', {outcome: 'COMPLETED', reason: 'program-completed'})));
    panel().within(() => {cy.get('ol li').should('have.length', 2); cy.contains('[role="status"]', 'Completado').should('be.visible');});
    cy.get('@input.all').should('have.length', 1);
  });
  it('does not claim cancellation from 202 and blocks overlapping test starts', () => {
    setup(); const channel = controlledStream(line(1, 'started', {mode: 'INTERACTIVE'}));
    cy.intercept('POST', '/api/snippets/' + snippetId + '/executions', {statusCode: 201, body: descriptor()}).as('start');
    cy.intercept('POST', '/api/executions/' + executionId + '/cancel', {statusCode: 202, body: {state: 'CANCELLING'}}).as('cancel');
    cy.visit('/', channel.options); open(); panel().contains('button', 'Ejecutar snippet').click(); cy.wait('@start');
    panel().contains('button', 'Detener').click(); cy.wait('@cancel');
    panel().contains('Esperando cancelación').should('be.visible'); panel().contains('Cancelación confirmada').should('not.exist');
    cy.contains('button', 'Ver tests').click(); cy.wait('@tests');
    cy.get('[role="dialog"]').contains('button', /^Ejecutar test$/).should('be.disabled');
    cy.get('[aria-label="Cerrar diálogo"]').click();
    cy.then(() => channel.end(line(2, 'terminal', {outcome: 'CANCELLED', reason: 'actor-cancelled'})));
    panel().contains('[role="status"]', 'Cancelación confirmada').should('be.visible');
  });
  it('keeps transport loss and technical failure distinct from an assertion difference', () => {
    setup(); cy.intercept('POST', '/api/snippets/' + snippetId + '/executions', {statusCode: 201, body: descriptor()}).as('start');
    cy.intercept('GET', '/api/executions/' + executionId + '/events?after=0', {headers: {'Content-Type': 'application/x-ndjson'},
      body: line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'output', {text: 'parcial'})});
    cy.intercept('GET', '/api/executions/' + executionId, {...descriptor(), state: 'RUNNING', lastSeq: 2});
    cy.intercept('GET', '/api/executions/' + executionId + '/events?after=2', {headers: {'Content-Type': 'application/x-ndjson'},
      body: line(3, 'terminal', {outcome: 'TECHNICAL_FAILURE', reason: 'interpreter-unavailable'})});
    cy.visit('/'); open(); panel().contains('button', 'Ejecutar snippet').click(); cy.wait('@start');
    panel().contains('Resultado desconocido').should('be.visible');
    panel().contains('button', 'Ejecutar snippet').should('be.disabled');
    panel().contains('button', 'Reconectar ejecución').click();
    panel().contains('[role="status"]', 'Falla técnica').should('be.visible');
    panel().contains('Test con diferencias').should('not.exist'); cy.get('@start.all').should('have.length', 1);
  });
  it('cancels on close and never carries private outputs to another snippet', () => {
    setup(); const channel = controlledStream(line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'output', {text: 'private old output'}));
    cy.intercept('POST', '/api/snippets/' + snippetId + '/executions', {statusCode: 201, body: descriptor()}).as('start');
    cy.intercept('POST', '/api/executions/' + executionId + '/cancel', {statusCode: 202, body: {state: 'CANCELLED'}}).as('cancel');
    cy.visit('/', channel.options); open(); panel().contains('button', 'Ejecutar snippet').click(); cy.wait('@start');
    panel().contains('private old output').should('be.visible'); cy.get('[aria-label="Cerrar detalle"]').click(); cy.wait('@cancel');
    cy.contains('button', 'Segundo').click(); cy.wait('@detail-' + secondId);
    panel().contains('private old output').should('not.exist'); panel().contains('Sin iniciar').scrollIntoView().should('be.visible');
  });
});

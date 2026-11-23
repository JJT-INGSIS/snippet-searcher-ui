// Real local providers. Only the development identity configuration is supplied.
const owner = {'X-Dev-Actor-Id': 'dev-thiago'};
const interactivePanel = () => cy.get('section[aria-label="Ejecución interactiva"]');
function create(name: string, code: string) {
  return cy.request({method: 'POST', url: '/api/snippets', headers: {...owner, 'Idempotency-Key': crypto.randomUUID()},
    body: {name, description: null, language: 'printscript', version: '1.1', code}}).then(response => {
    expect(response.status).to.eq(201);
    return response.body.id as string;
  });
}
function open(name: string) {
  cy.intercept('GET', '/app-config.json', {environment: 'dev', identity: {mode: 'dev', actorId: 'dev-thiago'}});
  cy.intercept('GET', /\/api\/snippets\/[0-9a-f-]+$/).as('readExecutionSnippet');
  cy.visit('/');
  cy.get('input[placeholder="Nombre del snippet…"]').type(name);
  cy.contains('[data-testid="snippet-row"] button', name, {timeout: 20000}).click();
  cy.wait('@readExecutionSnippet', {responseTimeout: 20000}).its('response.statusCode').should('eq', 200);
}
describe('SNI-102/110 execution with real providers', () => {
  beforeEach(() => {
    expect(new URL(Cypress.config('baseUrl') || '').hostname).to.be.oneOf(['localhost', '127.0.0.1', '[::1]']);
  });
  it('creates an ordered definition through the UI and distinguishes a matching test from a mismatch', () => {
    const name = 'SNI102-browser-' + Date.now();
    create(name, 'let nombre: string = readInput("Nombre?"); println(nombre);').then(id => {
      cy.request({method: 'POST', url: '/api/snippets/' + id + '/tests', headers: owner,
        body: {inputs: ['Ana'], expectedOutputs: ['Otra']}}).its('status').should('eq', 201);
      open(name);
      cy.contains('button', 'Ver tests').click();
      cy.get('[role="dialog"]').within(() => {
        cy.contains('[role="tab"]', 'Nuevo test').click();
        cy.contains('button', /^Agregar input$/).click();
        cy.get('textarea').filter('[id]').first().type('Ana');
        cy.contains('button', /^Agregar output esperado$/).click();
        cy.get('textarea').filter('[id]').last().type('Ana');
      });
      cy.intercept('POST', '/api/snippets/' + id + '/tests').as('saveDefinition');
      cy.get('[data-testid="save-test"]').click();
      cy.wait('@saveDefinition', {responseTimeout: 20000}).then(({request, response}) => {
        expect(response?.statusCode).to.eq(201);
        expect(request.body).to.deep.eq({inputs: ['Ana'], expectedOutputs: ['Ana']});
      });
      cy.contains('button', 'Ver tests').click();
      cy.get('[role="dialog"]').within(() => {
        cy.contains('[role="tab"]', /^Test 2$/).click();
        cy.contains('button', /^Ejecutar test$/).click();
        cy.contains('Test aprobado: los outputs coinciden exactamente.', {timeout: 20000}).should('exist');
        cy.get('ol[aria-label="Output de ejecución"] li').should('have.text', 'Ana');
        cy.contains('[role="tab"]', /^Test 1$/).click();
        cy.contains('button', /^Ejecutar test$/).click();
        cy.contains('Test con diferencias respecto de los outputs esperados.', {timeout: 20000}).should('exist');
        cy.get('ol[aria-label="Output de ejecución"] li').should('have.text', 'Ana');
      });
      cy.screenshot('sni102-real-test-comparison', {capture: 'viewport'});
    });
  });
  it('renders output before input, completes the real interpreter and starts again after cancellation', () => {
    const name = 'SNI110-browser-' + Date.now();
    create(name, 'println("Antes"); let nombre: string = readInput("Nombre?"); println("Hola, " + nombre);');
    open(name);
    interactivePanel().contains('button', 'Ejecutar snippet').click();
    interactivePanel().contains('Esperando input', {timeout: 20000}).should('exist');
    interactivePanel().find('ol li').should('have.text', 'Antes');
    interactivePanel().find('input').type('Ana');
    interactivePanel().contains('button', 'Enviar input').click();
    interactivePanel().contains('[role="status"]', 'Completado', {timeout: 20000}).should('exist');
    interactivePanel().find('ol li').then(items => expect([...items].map(item => item.textContent)).to.deep.eq(['Antes', 'Hola, Ana']));
    interactivePanel().contains('button', 'Ejecutar snippet').click();
    interactivePanel().contains('Esperando input', {timeout: 20000}).should('exist');
    interactivePanel().contains('button', 'Detener').click();
    interactivePanel().contains('[role="status"]', 'Cancelación confirmada', {timeout: 20000}).should('exist');
    interactivePanel().contains('button', 'Ejecutar snippet').click();
    interactivePanel().contains('Esperando input', {timeout: 20000}).should('exist');
    interactivePanel().contains('button', 'Detener').click();
    interactivePanel().contains('[role="status"]', 'Cancelación confirmada', {timeout: 20000}).should('exist');
    cy.screenshot('sni110-real-cancellation', {capture: 'viewport'});
  });
});

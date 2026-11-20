import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import {createApiClient, createHttpSnippetOperations} from './http';

const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const testId = '880e8400-e29b-41d4-a716-446655440000';
const input = {inputs: ['', 'ñ', 'ñ'], expectedOutputs: [' wrong ', '', 'wrong']};
const definition = {...input, id: testId, snippetId};
type Request = {url: string; method?: string; headers: IncomingMessage['headers']; body: string};
let requests: Request[] = [];
let respond: (request: Request, response: ServerResponse) => void;
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const request = {url: req.url!, method: req.method, headers: req.headers, body};
  requests.push(request);
  res.setHeader('Content-Type', 'application/json');
  respond(request, res);
});
const client = createApiClient({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-thiago'}});
const api = createHttpSnippetOperations(client, 'dev-thiago');
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  client.defaults.baseURL = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
  client.defaults.proxy = false;
});
afterAll(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
beforeEach(() => {requests = []; respond = (_, res) => res.end(JSON.stringify({items: [definition]}));});

describe('SNI-50 HTTP against a controlled contract server, not backend acceptance', () => {
  it('lists only the requested snippet with the shared identity transport', async () => {
    expect(await api.listTestDefinitions(snippetId)).toEqual([definition]);
    expect(requests[0]).toMatchObject({method: 'GET', url: '/api/snippets/' + snippetId + '/tests'});
    expect(requests[0].headers['x-dev-actor-id']).toBe('dev-thiago');
    expect(requests).toHaveLength(1);
  });
  it('creates once without executing or requiring passing expectations', async () => {
    respond = (_, res) => {res.statusCode = 201; res.end(JSON.stringify(definition));};
    expect(await api.createTestDefinition(snippetId, {...input, ownerId: 'ignored'} as typeof input)).toEqual(definition);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(requests[0].url).toBe('/api/snippets/' + snippetId + '/tests');
    expect(JSON.parse(requests[0].body)).toEqual(input);
  });
  it('returns a genuine empty list', async () => {
    respond = (_, res) => res.end(JSON.stringify({items: []}));
    expect(await api.listTestDefinitions(snippetId)).toEqual([]);
  });
  it.each([403, 404, 409, 503])('does not turn HTTP %s into success or an empty list', async status => {
    respond = (_, res) => {res.statusCode = status; res.end(JSON.stringify({type: 'urn:snippets:problem:test-failure', status}));};
    await expect(api.listTestDefinitions(snippetId)).rejects.toMatchObject({problem: {status}});
    await expect(api.createTestDefinition(snippetId, input)).rejects.toMatchObject({problem: {status}});
    expect(requests).toHaveLength(2);
  });
  it('rejects an acknowledgment with another snippet ID', async () => {
    respond = (_, res) => {res.statusCode = 201; res.end(JSON.stringify({...definition, snippetId: testId}));};
    await expect(api.createTestDefinition(snippetId, input)).rejects.toMatchObject({uncertain: true});
  });
  it('does not confirm a response that normalized or reordered saved values', async () => {
    respond = (_, res) => {res.statusCode = 201; res.end(JSON.stringify({...definition, inputs: ['ñ', 'ñ']}));};
    await expect(api.createTestDefinition(snippetId, input)).rejects.toMatchObject({uncertain: true});
  });
  it('rejects an unexpected success status or HTML representation', async () => {
    respond = (_, res) => res.end(JSON.stringify(definition));
    await expect(api.createTestDefinition(snippetId, input)).rejects.toThrow();
    respond = (_, res) => {res.setHeader('Content-Type', 'text/html'); res.end(JSON.stringify({items: []}));};
    await expect(api.listTestDefinitions(snippetId)).rejects.toThrow();
  });
  it('does not automatically repeat a POST with a lost acknowledgment', async () => {
    respond = (_, res) => res.destroy();
    await expect(api.createTestDefinition(snippetId, input)).rejects.toMatchObject({uncertain: true});
    expect(requests).toHaveLength(1);
  });
  it('cancels a read without a fictitious empty result', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(api.listTestDefinitions(snippetId, controller.signal)).rejects.toMatchObject({code: 'ERR_CANCELED'});
    expect(requests).toHaveLength(0);
  });
});

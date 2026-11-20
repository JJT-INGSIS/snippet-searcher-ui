import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import {createApiClient, createHttpSnippetOperations} from './http';

const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const formatted = {
  snippetId, name: 'Saludo', language: 'printscript', version: '1.1', extension: 'prs',
  code: 'let saludo: string = "¡Hola! 🚀";\n', source: 'on-demand',
  rulesRevision: 'sha256-v1:' + 'a'.repeat(64), processorRevision: 'sha256-v1:' + 'e'.repeat(64),
};
type Request = {url: URL; method?: string; headers: IncomingMessage['headers']};
let requests: Request[] = [];
let respond: (request: Request, response: ServerResponse) => void;
const server = createServer((req, res) => {
  const request = {url: new URL(req.url!, 'http://contract'), method: req.method, headers: req.headers};
  requests.push(request);
  res.setHeader('Content-Type', 'application/json');
  respond(request, res);
});
const client = createApiClient({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-ana'}});
const api = createHttpSnippetOperations(client, 'dev-ana');
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  client.defaults.baseURL = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
  client.defaults.proxy = false;
});
afterAll(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
beforeEach(() => {requests = []; respond = (_, res) => res.end(JSON.stringify(formatted));});

function problem(status: number, type: string, extra: object = {}) {
  return (_: Request, res: ServerResponse) => {
    res.statusCode = status;
    res.end(JSON.stringify({type: 'urn:snippets:problem:' + type, status, ...extra}));
  };
}

describe('formatted download against a contract server (not the real backend)', () => {
  it('asks once for the saved snippet with the actor identity and keeps the code exactly', async () => {
    expect(await api.getFormattedSnippet(snippetId)).toEqual(formatted);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url.pathname).toBe('/api/snippets/' + snippetId + '/formatted');
    expect(requests[0].headers['x-dev-actor-id']).toBe('dev-ana');
  });

  it('encodes the snippet id in the path', async () => {
    respond = problem(404, 'snippet-not-found');

    await expect(api.getFormattedSnippet('a/b')).rejects.toBeDefined();
    expect(requests[0].url.pathname).toBe('/api/snippets/a%2Fb/formatted');
  });

  it('keeps the diagnostics of code that cannot be formatted', async () => {
    const diagnostics = [{rule: 'UNTERMINATED_STRING', message: 'falta cerrar', line: 1, column: 9}];
    respond = problem(422, 'unformattable-code', {diagnostics});

    await expect(api.getFormattedSnippet(snippetId))
      .rejects.toMatchObject({problem: {status: 422, type: 'urn:snippets:problem:unformattable-code', diagnostics}});
  });

  it('reports a stale variant without retrying it', async () => {
    respond = problem(409, 'formatting-stale');

    await expect(api.getFormattedSnippet(snippetId))
      .rejects.toMatchObject({problem: {status: 409, type: 'urn:snippets:problem:formatting-stale'}});
    expect(requests).toHaveLength(1);
  });

  it('never accepts the variant of another snippet', async () => {
    respond = (_, res) => res.end(JSON.stringify({...formatted, snippetId: '770e8400-e29b-41d4-a716-446655440001'}));

    await expect(api.getFormattedSnippet(snippetId)).rejects.toBeDefined();
  });
});

import {afterAll, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import {createApiClient, createHttpSnippetOperations} from '../api/http';
import {createExecutionHttp} from '../api/executionHttp';
import {ExecutionSession} from '../executionSession';
import {parseRuntimeConfig} from '../api/config';
import {bearerIdentity} from './requestIdentity';

const config = parseRuntimeConfig({environment: 'dev', identity: {
  mode: 'auth0', domain: 'jjt-snippet-searcher.us.auth0.com', clientId: 'BDuvRyQ6ryyye08Bs9ZEfRzw7AsskFs6',
  audience: 'https://jjt-snippets-dev.duckdns.org/api',
}});
const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const executionId = '550e8400-e29b-41d4-a716-446655440000';
const limits = {totalSeconds: 120, inputWaitSeconds: 30, reconnectSeconds: 15, codeBytes: 1048576,
  inputBytes: 8192, outputBytes: 1048576, bufferEvents: 256, bufferBytes: 262144, terminalRetentionSeconds: 60};
const interactive = {executionId, snippetId, mode: 'INTERACTIVE', state: 'RUNNING', lastSeq: 0,
  snapshot: {language: 'printscript', version: '1.1', codeHash: 'sha256-v1:' + 'a'.repeat(64)}, limits};
const page = {page: 0, page_size: 10, count: 0, snippets: []};
type Request = {url: string; method?: string; headers: IncomingMessage['headers']};
let requests: Request[] = [];
let respond: (request: Request, response: ServerResponse) => void;
const server = createServer(async (req, res) => {
  for await (const chunk of req) void chunk;
  const request = {url: req.url!, method: req.method, headers: req.headers};
  requests.push(request);
  res.setHeader('Content-Type', 'application/json');
  respond(request, res);
});
let base = '';
const fetcher: typeof fetch = (input, init) => fetch(base + input, init);
const unauthorized = (res: ServerResponse) => {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Bearer');
  res.end(JSON.stringify({type: 'urn:snippets:problem:identity-unavailable', status: 401}));
};

function signedIn(tokens: string[] = ['token-1', 'token-2', 'token-3']) {
  const expired = vi.fn();
  const accessToken = vi.fn(async () => tokens.shift() ?? 'token-last');
  return {expired, accessToken, identity: bearerIdentity({actor: 'https://issuer/|auth0|ana', accessToken, expired})};
}

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
beforeEach(() => {requests = []; respond = (_, res) => res.end(JSON.stringify(page));});

describe('authenticated transports against a controlled API (not the real Snippets backend)', () => {
  it('sends a fresh bearer token on each Axios call and never the dev header', async () => {
    const {identity} = signedIn();
    const client = createApiClient(config, identity);
    client.defaults.baseURL = base + '/api';
    client.defaults.proxy = false;
    const api = createHttpSnippetOperations(client, identity.actor);

    await api.listSnippetDescriptors(0, 10);
    await api.listSnippetDescriptors(0, 10);

    expect(requests.map(request => request.headers.authorization)).toEqual(['Bearer token-1', 'Bearer token-2']);
    expect(requests[0].headers['x-dev-actor-id']).toBeUndefined();
  });

  it('keeps the public languages call without credentials and never sends the token to an absolute URL', async () => {
    const {identity, accessToken} = signedIn();
    const client = createApiClient(config, identity);
    client.defaults.baseURL = base + '/api';
    client.defaults.proxy = false;
    respond = (_, res) => res.end(JSON.stringify([{language: 'printscript', extension: 'prs', versions: ['1.1']}]));

    await client.get('/languages');
    await client.get(base + '/api/languages');

    expect(requests.map(request => request.headers.authorization)).toEqual([undefined, undefined]);
    expect(accessToken).not.toHaveBeenCalled();
  });

  it('opens the expired-session state on a 401 and never repeats the mutation', async () => {
    const {identity, expired} = signedIn();
    const client = createApiClient(config, identity);
    client.defaults.baseURL = base + '/api';
    client.defaults.proxy = false;
    const api = createHttpSnippetOperations(client, identity.actor);
    respond = (_, res) => unauthorized(res);

    await expect(api.updateSnippetById(snippetId, {name: 'n', description: null, language: 'printscript', version: '1.1', content: 'println(1);'}))
      .rejects.toMatchObject({problem: {status: 401, type: 'urn:snippets:problem:session-expired'}, uncertain: false});
    expect(requests).toHaveLength(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not send the request at all when the session needs a new login', async () => {
    const expired = vi.fn();
    const identity = bearerIdentity({actor: 'a', accessToken: () => Promise.reject({error: 'login_required'}), expired});
    const client = createApiClient(config, identity);
    client.defaults.baseURL = base + '/api';
    client.defaults.proxy = false;

    await expect(createHttpSnippetOperations(client, 'a').listSnippetDescriptors(0, 10))
      .rejects.toMatchObject({problem: {type: 'urn:snippets:problem:session-expired'}});
    expect(requests).toHaveLength(0);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('authenticates every NDJSON operation with the same token source', async () => {
    const {identity} = signedIn(['start', 'describe', 'input', 'cancel']);
    const http = createExecutionHttp(config, fetcher, identity);
    const signal = new AbortController().signal;
    respond = (request, res) => {
      if (request.url.endsWith('/inputs')) {res.end(JSON.stringify({requestId: 'r', accepted: true})); return;}
      if (request.url.endsWith('/cancel')) {res.statusCode = 202; res.end(JSON.stringify({executionId, state: 'CANCELLED'})); return;}
      res.statusCode = request.method === 'POST' ? 201 : 200;
      res.end(JSON.stringify(interactive));
    };

    const descriptor = await http.start({snippetId}, signal);
    await http.describe(descriptor, signal);
    await http.input(executionId, 'r', 'x', signal);
    await http.cancel(executionId, signal).catch(() => undefined);

    expect(requests.map(request => request.headers.authorization))
      .toEqual(['Bearer start', 'Bearer describe', 'Bearer input', 'Bearer cancel']);
    expect(requests.every(request => request.headers['x-dev-actor-id'] === undefined)).toBe(true);
  });

  it('reports a 401 on the NDJSON side as an expired session', async () => {
    const {identity, expired} = signedIn();
    const http = createExecutionHttp(config, fetcher, identity);
    respond = (_, res) => unauthorized(res);

    await expect(http.start({snippetId}, new AbortController().signal))
      .rejects.toMatchObject({problem: {status: 401, type: 'urn:snippets:problem:session-expired'}});
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('releases a session locally without asking the server to cancel the execution', async () => {
    const {identity} = signedIn();
    const session = new ExecutionSession(createExecutionHttp(config, fetcher, identity));
    respond = (_, res) => {res.statusCode = 201; res.end(JSON.stringify(interactive));};
    void session.start({snippetId});
    await new Promise(resolve => setTimeout(resolve, 50));
    const before = requests.length;

    session.release();
    session.close({snippetId});
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(requests.slice(before).some(request => request.url.endsWith('/cancel'))).toBe(false);
    expect(session.getSnapshot().phase).toBe('IDLE');
  });
});

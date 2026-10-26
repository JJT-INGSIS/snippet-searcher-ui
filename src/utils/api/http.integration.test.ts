import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';

import {createApiClient, createHttpSnippetOperations} from './http';
import {createCreationIntent} from './creationIntent';
import {ApiError} from './errors';
const metadata = {id: '0f8b3c1e-4a2d-4d3b-9b7a-2c6e5f1a9d40', name: 'Hello', description: null, language: 'printscript', version: '1.0'};
const descriptor = {...metadata, ownerId: 'dev-juan', extension: 'prs', relation: 'owned', lint: {status: 'not-implemented'}};
const input = {...metadata, content: 'println(1);'};
type Request = {url: URL; method?: string; headers: IncomingMessage['headers']; body: string};
let requests: Request[] = [];
let respond: (request: Request, response: ServerResponse) => void;
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const request = {url: new URL(req.url!, 'http://contract'), method: req.method, headers: req.headers, body};
  requests.push(request); res.setHeader('Content-Type', 'application/json'); respond(request, res);
});
const client = createApiClient({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}});
const api = createHttpSnippetOperations(client, 'dev-juan');
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  client.defaults.baseURL = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
  client.defaults.proxy = false;
});
afterAll(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
beforeEach(() => {requests = []; respond = (_, res) => res.end(JSON.stringify(metadata));});
describe('HTTP adapter against a contract server (not the real backend)', () => {
  it('cancels superseded reads without translating cancellation into an API failure', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(api.listSnippetDescriptors(0, 10, {}, controller.signal)).rejects.toMatchObject({code: 'ERR_CANCELED'});
    await expect(api.getUserFriends('', 0, 5, controller.signal)).rejects.toMatchObject({code: 'ERR_CANCELED'});
    expect(requests).toHaveLength(0);
  });
  it('sends POST with UUID and actor; repeats exact data/key after a lost acknowledgment, without a hidden GET', async () => {
    const intent = createCreationIntent(input, 'dev-juan', () => '72c53308-1139-4ac8-9985-1f94b101a70e');
    respond = (_, res) => res.destroy();
    await expect(api.createSnippet(intent)).rejects.toBeInstanceOf(ApiError);
    respond = (_, res) => {res.statusCode = 200; res.end(JSON.stringify(metadata));};
    expect(await api.createSnippet(intent)).toEqual(metadata);
    expect(requests).toHaveLength(2);
    expect(requests[0].headers['idempotency-key']).toBe(intent.key);
    expect(requests[1].headers['idempotency-key']).toBe(intent.key);
    expect(requests[0].body).toBe(requests[1].body);
    expect(JSON.parse(requests[0].body)).toEqual({name: 'Hello', description: null, language: 'printscript', version: '1.0', code: 'println(1);'});
    expect(requests[0].headers['x-dev-actor-id']).toBe('dev-juan');
    expect(requests[0].method).toBe('POST');
  });
  it('returns only metadata for a new 201 creation', async () => {
    respond = (_, res) => {res.statusCode = 201; res.end(JSON.stringify(metadata));};
    expect(await api.createSnippet(createCreationIntent(input, 'dev-juan'))).not.toHaveProperty('content');
    expect(requests).toHaveLength(1);
  });
  it('rejects an intent from another actor before HTTP', async () => {
    await expect(api.createSnippet(createCreationIntent(input, 'dev-ana'))).rejects.toThrow('another identity');
    expect(requests).toHaveLength(0);
  });
  it('sends the complete PUT and does not fabricate detail or request it afterward', async () => {
    expect(await api.updateSnippetById(metadata.id, input)).toEqual(metadata);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('PUT');
    expect(JSON.parse(requests[0].body)).toHaveProperty('version', '1.0');
    expect(requests[0].headers['idempotency-key']).toBeUndefined();
  });
  it('maps zero-based pagination, filters and descriptors without fetching each detail', async () => {
    respond = (_, res) => res.end(JSON.stringify({page: 0, page_size: 5, count: 1, snippets: [descriptor]}));
    const result = await api.listSnippetDescriptors(0, 5, {name: ' x ', language: 'printscript', relation: 'shared', sort: 'language', direction: 'desc'});
    expect(Object.fromEntries(requests[0].url.searchParams)).toEqual({page: '0', page_size: '5', name: ' x ', language: 'printscript', relation: 'shared', sort: 'language', direction: 'desc'});
    expect(result.snippets[0]).not.toHaveProperty('content'); expect(requests).toHaveLength(1);
  });
  it('gets detail, recipients and share acknowledgments without pretending a share is a snippet', async () => {
    respond = (req, res) => res.end(JSON.stringify(req.url.pathname.endsWith('/users') ? {page: 0, page_size: 5, count: 1, users: [{id: 'dev-ana', name: 'Ana'}]}
      : req.method === 'PUT' ? {snippetId: metadata.id, userId: 'user/a b'} : {...descriptor, code: 'println(1);', capabilities: {modify: false, share: false}}));
    expect((await api.getSnippetById(metadata.id)).capabilities.modify).toBe(false);
    expect((await api.getUserFriends('Ana', 0, 5)).users).toHaveLength(1);
    expect(await api.shareSnippet(metadata.id, 'user/a b')).toEqual({snippetId: metadata.id, userId: 'user/a b'});
    expect(requests[2].url.pathname).toContain('user%2Fa%20b');
    expect(requests[2].body).toBe('');
    expect(requests).toHaveLength(3);
  });
  it('requires the real language catalog and never substitutes fallback data', async () => {
    respond = (_, res) => {res.statusCode = 404; res.end(JSON.stringify({type: 'urn:snippets:problem:not-found'}));};
    await expect(api.getFileTypes()).rejects.toMatchObject({problem: {status: 404}});
    expect(requests[0].headers['x-dev-actor-id']).toBeUndefined();
  });
  it('disables unavailable operations without a request', async () => {
    await expect(api.deleteSnippet('id')).rejects.toThrow('not available');
    await expect(api.formatSnippet('code')).rejects.toThrow('not available');
    await expect(api.removeTestCase('id')).rejects.toThrow('not available'); expect(requests).toHaveLength(0);
  });
  it('does not inject a dev identity in prod', async () => {
    const prod = createApiClient({environment: 'prod', identity: {mode: 'disabled'}});
    prod.defaults.baseURL = client.defaults.baseURL; prod.defaults.proxy = false;
    await prod.get('/languages');
    await prod.get('/snippets');
    expect(requests[1].headers['x-dev-actor-id']).toBeUndefined();
  });
  it('propagates structured failures instead of an empty list or a successful mutation', async () => {
    respond = (_, res) => {res.statusCode = 503; res.end(JSON.stringify({type: 'urn:snippets:problem:metadata-unavailable'}));};
    await expect(api.listSnippetDescriptors(0, 10)).rejects.toMatchObject({problem: {status: 503}});
    await expect(api.updateSnippetById(metadata.id, input)).rejects.toBeInstanceOf(ApiError);
    expect(requests).toHaveLength(2);

  });
});

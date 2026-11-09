import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import {createApiClient, createHttpSnippetOperations} from './http';

const revision = 'sha256-v1:' + 'a'.repeat(64);
const jobId = '990e8400-e29b-41d4-a716-446655440000';
const identifier = {
  id: 'identifier_format', type: 'choice', acceptsNull: true, choices: ['camel case', 'snake case'],
  conflictsWith: [], value: 'snake case',
};
const rules = {language: 'printscript', version: '1.1', revision, changed: true, jobId, rules: [identifier]};
type Request = {url: URL; method?: string; headers: IncomingMessage['headers']; body: string};
let requests: Request[] = [];
let respond: (request: Request, response: ServerResponse) => void;
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const request = {url: new URL(req.url!, 'http://contract'), method: req.method, headers: req.headers, body};
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
beforeEach(() => {requests = []; respond = (_, res) => res.end(JSON.stringify(rules));});

describe('linting rules against a contract server (not the real backend)', () => {
  it('reads the rules of one scope with the actor identity', async () => {
    expect((await api.getLintingRules('printscript', '1.1')).rules).toEqual([identifier]);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url.pathname).toBe('/api/linting-rules/printscript/1.1');
    expect(requests[0].headers['x-dev-actor-id']).toBe('dev-ana');
  });

  it('saves the whole selection once and returns the job to follow', async () => {
    const saved = await api.saveLintingRules('printscript', '1.1', {identifier_format: 'snake case'});

    expect(saved.jobId).toBe(jobId);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('PUT');
    expect(JSON.parse(requests[0].body)).toEqual({rules: {identifier_format: 'snake case'}});
  });

  it('keeps the rule violations of a rejected save and never retries it', async () => {
    const violations = [{rule: 'identifier_format', reason: 'invalid-choice'}];
    respond = (_, res) => {
      res.statusCode = 422;
      res.end(JSON.stringify({type: 'urn:snippets:problem:invalid-linting-rules', violations}));
    };

    await expect(api.saveLintingRules('printscript', '1.1', {identifier_format: 'kebab'}))
      .rejects.toMatchObject({problem: {status: 422, violations}, uncertain: false});
    expect(requests).toHaveLength(1);
  });

  it('encodes the scope in the path', async () => {
    respond = (_, res) => res.end(JSON.stringify({...rules, language: 'print script', version: '1/1'}));

    await api.getLintingRules('print script', '1/1');

    expect(requests[0].url.pathname).toBe('/api/linting-rules/print%20script/1%2F1');
  });
});

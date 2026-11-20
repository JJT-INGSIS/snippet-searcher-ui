import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import {createApiClient, createHttpSnippetOperations} from './http';

const revision = 'sha256-v1:' + 'b'.repeat(64);
const jobId = '990e8400-e29b-41d4-a716-446655440000';
const indent = {
  id: 'indent-inside-if', type: 'integer', default: null, minimum: 0, maximum: 10,
  conflictsWith: [], description: 'Sangría dentro de un if.', value: 2,
};
const rules = {language: 'printscript', version: '1.1', revision, changed: true, jobId, rules: [indent]};
const progress = {id: jobId, status: 'RUNNING', processed: 1, failed: 0, pending: 2, selectionComplete: true};
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
const client = createApiClient({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}});
const api = createHttpSnippetOperations(client, 'dev-juan');
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  client.defaults.baseURL = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api';
  client.defaults.proxy = false;
});
afterAll(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
beforeEach(() => {requests = []; respond = (_, res) => res.end(JSON.stringify(rules));});

describe('formatting rules and job progress against a contract server (not the real backend)', () => {
  it('reads the rules of one scope with the actor identity', async () => {
    expect((await api.getFormattingRules('printscript', '1.1')).rules).toEqual([indent]);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].url.pathname).toBe('/api/formatting-rules/printscript/1.1');
    expect(requests[0].headers['x-dev-actor-id']).toBe('dev-juan');
  });

  it('saves the whole selection once and returns what the backend confirmed', async () => {
    const saved = await api.saveFormattingRules('printscript', '1.1', {'indent-inside-if': 2});

    expect(saved.jobId).toBe(jobId);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('PUT');
    expect(JSON.parse(requests[0].body)).toEqual({rules: {'indent-inside-if': 2}});
  });

  it('keeps the rule violations of a rejected save and never retries it', async () => {
    const violations = [{rule: 'indent-inside-if', reason: 'out-of-range'}];
    respond = (_, res) => {
      res.statusCode = 422;
      res.end(JSON.stringify({type: 'urn:snippets:problem:invalid-formatting-rules', violations}));
    };

    await expect(api.saveFormattingRules('printscript', '1.1', {'indent-inside-if': 11}))
      .rejects.toMatchObject({problem: {status: 422, violations}, uncertain: false});
    expect(requests).toHaveLength(1);
  });

  it('marks a save without an answer as uncertain', async () => {
    respond = (_, res) => res.destroy();

    await expect(api.saveFormattingRules('printscript', '1.1', {})).rejects.toMatchObject({uncertain: true});
    expect(requests).toHaveLength(1);
  });

  it('encodes the scope and rejects an answer for another scope', async () => {
    await expect(api.getFormattingRules('print script', '1/1')).rejects.toThrow('Unexpected API response');
    expect(requests[0].url.pathname).toBe('/api/formatting-rules/print%20script/1%2F1');
  });

  it('reads the progress of a job and cancels a superseded read before sending it', async () => {
    respond = (_, res) => res.end(JSON.stringify(progress));

    expect(await api.getJobProgress(jobId)).toEqual(progress);
    expect(requests[0].url.pathname).toBe('/api/jobs/' + jobId);

    const controller = new AbortController();
    controller.abort();
    await expect(api.getJobProgress(jobId, controller.signal)).rejects.toMatchObject({code: 'ERR_CANCELED'});
    expect(requests).toHaveLength(1);
  });
});

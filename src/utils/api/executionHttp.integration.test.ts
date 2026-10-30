import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {AddressInfo} from 'node:net';
import {createExecutionHttp} from './executionHttp';
import {ExecutionSession} from '../executionSession';
import {ExecutionEvent} from './executionDtos';

const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const testId = '880e8400-e29b-41d4-a716-446655440000';
const executionId = '550e8400-e29b-41d4-a716-446655440000';
const requestId = '660e8400-e29b-41d4-a716-446655440000';
const limits = {totalSeconds: 120, inputWaitSeconds: 30, reconnectSeconds: 15, codeBytes: 1048576,
  inputBytes: 8192, outputBytes: 1048576, bufferEvents: 256, bufferBytes: 262144, terminalRetentionSeconds: 60};
const interactive = {executionId, snippetId, mode: 'INTERACTIVE', state: 'STARTING', lastSeq: 0,
  snapshot: {language: 'printscript', version: '1.1', codeHash: 'sha256-v1:' + 'a'.repeat(64)}, limits};
const test = {...interactive, mode: 'TEST', testId, snapshot: {...interactive.snapshot, testHash: 'sha256-v1:' + 'b'.repeat(64)}};
const event = (seq: number, type: string, data: unknown) => ({executionId, seq, type, data});
const line = (seq: number, type: string, data: unknown) => JSON.stringify(event(seq, type, data)) + '\n';
type Request = {url: string; method?: string; headers: IncomingMessage['headers']; body: string};
let requests: Request[] = [];
let respond: (request: Request, response: ServerResponse) => void;
const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const request = {url: req.url!, method: req.method, headers: req.headers, body};
  requests.push(request); res.setHeader('Content-Type', 'application/json'); respond(request, res);
});
let base = '';
const fetcher: typeof fetch = (input, init) => fetch(base + input, init);
const api = () => createExecutionHttp({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-thiago'}}, fetcher);
const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!predicate()) {if (Date.now() > deadline) throw new Error('Condition timed out'); await new Promise(resolve => setTimeout(resolve, 5));}
};
const stream = (res: ServerResponse, body: string) => {res.setHeader('Content-Type', 'application/x-ndjson'); res.end(body);};
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));});
beforeEach(() => {requests = []; respond = (_, res) => {res.statusCode = 201; res.end(JSON.stringify(interactive));};});

describe('SNI-51 fetch NDJSON against an HTTP contract server (not backend acceptance)', () => {
  it('renders an output before the server is allowed to send its terminal, preserving split UTF-8, empty and duplicate lines', async () => {
    const session = new ExecutionSession(api());
    const held: {response?: ServerResponse} = {};
    respond = (req, res) => {
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(test)); return;}
      res.setHeader('Content-Type', 'application/x-ndjson');
      res.write(line(1, 'started', {mode: 'TEST'}) + line(2, 'output', {text: ''}));
      const bytes = Buffer.from(line(3, 'output', {text: 'ñ'}));
      const split = bytes.indexOf(Buffer.from('ñ')) + 1;
      res.write(bytes.subarray(0, split));
      setTimeout(() => {res.write(bytes.subarray(split)); res.write(line(4, 'output', {text: 'ñ'})); held.response = res;}, 10);
    };
    const running = session.start({snippetId, testId});
    await waitFor(() => session.getSnapshot().outputs.length === 3);
    expect(session.getSnapshot().outputs).toEqual(['', 'ñ', 'ñ']);
    expect(session.getSnapshot().terminal).toBeUndefined();
    held.response!.end(line(5, 'terminal', {outcome: 'COMPLETED', reason: 'program-completed', comparison: 'PASSED', unusedInputs: 0}));
    await running;
    expect(session.getSnapshot().terminal?.comparison).toBe('PASSED');
    expect(requests[0]).toMatchObject({method: 'POST', url: '/api/snippets/' + snippetId + '/tests/' + testId + '/executions', body: '{}'});
    expect(requests.every(req => req.headers['x-dev-actor-id'] === 'dev-thiago')).toBe(true);
    session.close({snippetId, testId});
    expect(session.getSnapshot()).toMatchObject({phase: 'IDLE', outputs: []});
    expect(session.getSnapshot().terminal).toBeUndefined();
  });
  it.each(['', 'á\n'])('posts input %j only for the matching prompt, without echoing locally or sending twice', async value => {
    const session = new ExecutionSession(api());
    const held: {response?: ServerResponse} = {};
    respond = (req, res) => {
      if (req.url.endsWith('/inputs')) {
        expect(JSON.parse(req.body)).toEqual({requestId, value});
        res.end(JSON.stringify({requestId, accepted: true}));
        held.response!.end(line(4, 'input-accepted', {requestId}) + line(5, 'output', {text: value}) +
          line(6, 'terminal', {outcome: 'COMPLETED', reason: 'program-completed'})); return;
      }
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(interactive)); return;}
      held.response = res; res.setHeader('Content-Type', 'application/x-ndjson');
      res.write(line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'output', {text: 'antes'}) + line(3, 'input-required', {requestId, prompt: 'Nombre?'}));
    };
    await session.input({snippetId}, 'premature'); expect(requests).toHaveLength(0);
    const running = session.start({snippetId});
    await waitFor(() => !!session.getSnapshot().prompt);
    expect(session.getSnapshot().outputs).toEqual(['antes']);
    await Promise.all([session.input({snippetId}, value), session.input({snippetId}, 'duplicate')]);
    await running;
    expect(session.getSnapshot().outputs).toEqual(['antes', value]);
    expect(requests.filter(req => req.url.endsWith('/inputs'))).toHaveLength(1);
  });
  it('reconnects with the last applied cursor, deduplicates replay, and never starts a second interpreter', async () => {
    const session = new ExecutionSession(api());
    respond = (req, res) => {
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(interactive)); return;}
      if (req.url === '/api/executions/' + executionId) {res.end(JSON.stringify({...interactive, state: 'RUNNING', lastSeq: 2})); return;}
      if (req.url.endsWith('after=0')) stream(res, line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'output', {text: 'parcial'}));
      else stream(res, line(2, 'output', {text: 'parcial'}) + line(3, 'terminal', {outcome: 'COMPLETED', reason: 'program-completed'}));
    };
    await session.start({snippetId}); expect(session.getSnapshot().phase).toBe('UNKNOWN');
    await session.reconnect({snippetId});
    expect(session.getSnapshot().outputs).toEqual(['parcial']); expect(session.getSnapshot().phase).toBe('COMPLETED');
    expect(requests.map(req => req.method)).toEqual(['POST', 'GET', 'GET', 'GET']);
    expect(requests[3].url).toContain('after=2');
  });
  it('does not translate a technical terminal into an assertion failure', async () => {
    respond = (req, res) => {
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(test)); return;}
      stream(res, line(1, 'started', {mode: 'TEST'}) + line(2, 'terminal', {outcome: 'TECHNICAL_FAILURE', reason: 'interpreter-unavailable'}));
    };
    const session = new ExecutionSession(api()); await session.start({snippetId, testId});
    expect(session.getSnapshot().phase).toBe('TECHNICAL_FAILURE'); expect(session.getSnapshot().terminal?.comparison).toBeUndefined();
  });
  it.each(['\n', '{"broken":\n', line(2, 'output', {text: 'gap'}), line(1, 'started', {mode: 'TEST'})])('leaves invalid or missing events unknown instead of successful', async body => {
    respond = (req, res) => {
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(interactive)); return;}
      stream(res, body);
    };
    const session = new ExecutionSession(api()); await session.start({snippetId});
    expect(session.getSnapshot().phase).toBe('UNKNOWN'); expect(session.getSnapshot().terminal).toBeUndefined();
  });
  it('preserves HTTP error categories and does not replay an uncertain start', async () => {
    const session = new ExecutionSession(api());
    respond = (_, res) => res.destroy();
    await session.start({snippetId});
    expect(session.getSnapshot()).toMatchObject({phase: 'UNKNOWN', startUncertain: true});
    expect(requests).toHaveLength(1);
    respond = (_, res) => {res.statusCode = 409; res.end(JSON.stringify({type: 'urn:snippets:problem:execution-already-active'}));};
    await expect(api().start({snippetId}, new AbortController().signal)).rejects.toMatchObject({problem: {status: 409, type: 'urn:snippets:problem:execution-already-active'}});
  });
  it('requires an actual terminal after 202 CANCELLING and blocks another start across modes', async () => {
    const session = new ExecutionSession(api());
    const held: {response?: ServerResponse} = {};
    respond = (req, res) => {
      if (req.url.endsWith('/cancel')) {res.statusCode = 202; res.end(JSON.stringify({state: 'CANCELLING'})); return;}
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(interactive)); return;}
      held.response = res; res.setHeader('Content-Type', 'application/x-ndjson'); res.write(line(1, 'started', {mode: 'INTERACTIVE'}));
    };
    const running = session.start({snippetId}); await waitFor(() => session.getSnapshot().lastSeq === 1);
    await session.cancel({snippetId}); await session.start({snippetId, testId});
    expect(session.getSnapshot().phase).toBe('CANCELLING'); expect(session.getSnapshot().terminal).toBeUndefined();
    expect(requests.filter(req => req.url.endsWith('/executions'))).toHaveLength(1);
    held.response!.end(line(2, 'terminal', {outcome: 'CANCELLED', reason: 'actor-cancelled'}));
    await running; expect(session.getSnapshot().phase).toBe('CANCELLED');
  });
  it('sends no arbitrary identity in prod and rejects dev identity in prod', async () => {
    const prod = createExecutionHttp({environment: 'prod', identity: {mode: 'disabled'}}, fetcher);
    await prod.start({snippetId}, new AbortController().signal);
    expect(requests[0].headers['x-dev-actor-id']).toBeUndefined();
    expect(() => createExecutionHttp({environment: 'prod', identity: {mode: 'dev', actorId: 'x'}}, fetcher)).toThrow();
  });
  it('clears cached output if reconnect authorization is revoked and never starts again automatically', async () => {
    const session = new ExecutionSession(api());
    respond = (req, res) => {
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(interactive)); return;}
      if (req.url.includes('/events?')) stream(res, line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'output', {text: 'private'}));
      else {res.statusCode = 403; res.end(JSON.stringify({type: 'urn:snippets:problem:access-denied'}));}
    };
    await session.start({snippetId}); expect(session.getSnapshot().outputs).toEqual(['private']);
    await session.reconnect({snippetId});
    expect(session.getSnapshot()).toMatchObject({phase: 'UNKNOWN', outputs: [], unavailable: true});
    expect(requests.filter(req => req.method === 'POST')).toHaveLength(1);
  });
  it('locks an uncertain input to its original value and permits a compatible explicit retry', async () => {
    const session = new ExecutionSession(api()), held: {response?: ServerResponse} = {};
    const attempts = {count: 0};
    respond = (req, res) => {
      if (req.url.endsWith('/inputs')) {
        expect(JSON.parse(req.body)).toEqual({requestId, value: 'original'});
        if (++attempts.count === 1) res.destroy();
        else {
          res.end(JSON.stringify({requestId, accepted: true}));
          held.response!.end(line(3, 'input-accepted', {requestId}) + line(4, 'terminal', {outcome: 'COMPLETED', reason: 'program-completed'}));
        }
        return;
      }
      if (req.method === 'POST') {res.statusCode = 201; res.end(JSON.stringify(interactive)); return;}
      held.response = res; res.setHeader('Content-Type', 'application/x-ndjson');
      res.write(line(1, 'started', {mode: 'INTERACTIVE'}) + line(2, 'input-required', {requestId, prompt: 'Valor?'}));
    };
    const running = session.start({snippetId}); await waitFor(() => !!session.getSnapshot().prompt);
    await session.input({snippetId}, 'original');
    await session.input({snippetId}, 'different'); expect(attempts.count).toBe(1);
    expect(session.getSnapshot().message).toContain('mismo valor');
    await session.input({snippetId}, 'original'); await running;
    expect(attempts.count).toBe(2); expect(session.getSnapshot().phase).toBe('COMPLETED');
  });
  it('ignores a late output after close and cancels using the known session ID', async () => {
    const callbacks: {receive?: (event: ExecutionEvent) => void} = {};
    const transport = api();
    const session = new ExecutionSession({...transport,
      async events(_, __, signal, receive) {
        callbacks.receive = receive;
        receive(event(1, 'started', {mode: 'INTERACTIVE'}) as ExecutionEvent);
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), {once: true}));
      },
      async cancel() {return 'CANCELLED';},
    });
    const running = session.start({snippetId}); await waitFor(() => !!callbacks.receive);
    session.close({snippetId}); await running;
    callbacks.receive!(event(2, 'output', {text: 'stale secret'}) as ExecutionEvent);
    expect(session.getSnapshot().outputs).toEqual([]);
    await session.start({snippetId: '770e8400-e29b-41d4-a716-446655440001'});
    expect(session.getSnapshot().outputs).toEqual([]); // mismatched descriptor is rejected, no stale content.
  });
});

import {RuntimeConfig, identityHeaders} from './config';
import {ApiError} from './errors';
import {ExecutionDescriptor, ExecutionEvent, ExecutionTarget, fromCancel, fromExecutionDescriptor, fromExecutionEvent, protocolError} from './executionDtos';

export type ExecutionHttp = ReturnType<typeof createExecutionHttp>;
export function createExecutionHttp(config: RuntimeConfig, fetcher: typeof fetch = (...args) => fetch(...args)) {
  const identity = identityHeaders(config);
  async function request(path: string, signal: AbortSignal, body?: unknown, accept = 'application/json') {
    const response = await fetcher('/api' + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: {...identity, Accept: accept, ...(body === undefined ? {} : {'Content-Type': 'application/json'})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new ApiError('No se pudo completar la operación (HTTP ' + response.status + ').', {
        type: typeof problem?.type === 'string' ? problem.type : 'about:blank', status: response.status,
      }, response.status >= 500);
    }
    return response;
  }
  async function json(path: string, signal: AbortSignal, expectedStatus: number, body?: unknown): Promise<unknown> {
    const response = await request(path, signal, body);
    if (response.status !== expectedStatus || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw protocolError();
    return response.json();
  }
  const sessionPath = (executionId: string) => '/executions/' + encodeURIComponent(executionId);
  return {
    async start(target: ExecutionTarget, signal: AbortSignal) {
      const path = '/snippets/' + encodeURIComponent(target.snippetId) +
        (target.testId ? '/tests/' + encodeURIComponent(target.testId) : '') + '/executions';
      return fromExecutionDescriptor(await json(path, signal, 201, {}), target);
    },
    async describe(descriptor: ExecutionDescriptor, signal: AbortSignal) {
      return fromExecutionDescriptor(await json(sessionPath(descriptor.executionId), signal, 200), descriptor, descriptor.executionId);
    },
    async input(executionId: string, requestId: string, value: string, signal: AbortSignal) {
      const result = await json(sessionPath(executionId) + '/inputs', signal, 200, {requestId, value});
      if (!result || typeof result !== 'object' || !('requestId' in result) || result.requestId !== requestId ||
          !('accepted' in result) || result.accepted !== true) throw protocolError();
    },
    async cancel(executionId: string, signal: AbortSignal) {
      return fromCancel(await json(sessionPath(executionId) + '/cancel', signal, 202, {}));
    },
    async events(descriptor: ExecutionDescriptor, after: number, signal: AbortSignal, receive: (event: ExecutionEvent) => void) {
      const response = await request(sessionPath(descriptor.executionId) + '/events?after=' + after, signal, undefined, 'application/x-ndjson');
      if (response.status !== 200 || !/^application\/x-ndjson(?:;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) throw protocolError();
      const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', {fatal: true});
      const pending = {text: ''};
      try {
        for (;;) {
          const {value, done} = await reader.read();
          pending.text += done ? decoder.decode() : decoder.decode(value, {stream: true});
          for (;;) {
            const newline = pending.text.indexOf('\n');
            if (newline < 0) break;
            const line = pending.text.slice(0, newline);
            pending.text = pending.text.slice(newline + 1);
            if (!line || new TextEncoder().encode(line).length > descriptor.limits.bufferBytes) throw protocolError();
            const event = fromExecutionEvent(JSON.parse(line), descriptor);
            receive(event);
            if (event.type === 'terminal') return;
          }
          if (new TextEncoder().encode(pending.text).length > descriptor.limits.bufferBytes) throw protocolError();
          if (done) {
            if (pending.text) throw protocolError();
            return; // EOF is transport loss; only a terminal event confirms a result.
          }
        }
      } finally {await reader.cancel().catch(() => undefined); reader.releaseLock();}
    },
  };
}

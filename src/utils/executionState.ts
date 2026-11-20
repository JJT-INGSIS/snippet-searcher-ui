import {ExecutionDescriptor, ExecutionEvent, ExecutionTarget, ServerState, Terminal} from './api/executionDtos';

export type ExecutionView = {
  target?: ExecutionTarget; descriptor?: ExecutionDescriptor; phase: ServerState | 'IDLE' | 'UNKNOWN';
  outputs: readonly string[]; outputBytes: number; lastSeq: number; prompt?: {requestId: string; prompt: string};
  terminal?: Terminal; sending: boolean; connecting: boolean; message?: string; startUncertain?: boolean; unavailable?: boolean;
};
export const idleExecution: ExecutionView = {phase: 'IDLE', outputs: [], outputBytes: 0, lastSeq: 0, sending: false, connecting: false};
type EventResult = {ok: true; view: ExecutionView} | {ok: false; reason: 'invalid-event' | 'output-limit'};

/** Pure progression: transport callbacks never mutate a previously returned snapshot. */
export function applyExecutionEvent(view: ExecutionView, event: ExecutionEvent): EventResult {
  if (event.seq <= view.lastSeq) return {ok: true, view};
  if (view.terminal || event.seq !== view.lastSeq + 1 || (event.seq === 1 && event.type !== 'started')) return {ok: false, reason: 'invalid-event'};
  const next = {...view, lastSeq: event.seq, connecting: false};
  switch (event.type) {
    case 'started': return {ok: true, view: {...next, phase: view.phase === 'CANCELLING' ? 'CANCELLING' : 'RUNNING'}};
    case 'output': {
      const outputBytes = view.outputBytes + new TextEncoder().encode(event.data.text).length;
      if (!view.descriptor || outputBytes > view.descriptor.limits.outputBytes) return {ok: false, reason: 'output-limit'};
      return {ok: true, view: {...next, outputs: [...view.outputs, event.data.text], outputBytes}};
    }
    case 'input-required':
      return view.prompt ? {ok: false, reason: 'invalid-event'} : {ok: true, view: {...next, prompt: event.data, phase: view.phase === 'CANCELLING' ? 'CANCELLING' : 'WAITING_INPUT'}};
    case 'input-accepted':
      return view.prompt?.requestId !== event.data.requestId ? {ok: false, reason: 'invalid-event'} :
        {ok: true, view: {...next, prompt: undefined, sending: false, phase: view.phase === 'CANCELLING' ? 'CANCELLING' : 'RUNNING'}};
    case 'terminal': return {ok: true, view: {...next, terminal: event.data, phase: event.data.outcome, prompt: undefined, sending: false}};
    case 'heartbeat': return {ok: true, view: next};
  }
}

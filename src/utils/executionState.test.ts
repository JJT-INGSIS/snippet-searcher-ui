import {describe, expect, it} from 'vitest';
import {applyExecutionEvent, idleExecution} from './executionState';
import {ExecutionDescriptor} from './api/executionDtos';

const executionId = '550e8400-e29b-41d4-a716-446655440000';
const descriptor: ExecutionDescriptor = {executionId, snippetId: '770e8400-e29b-41d4-a716-446655440000', mode: 'INTERACTIVE', state: 'RUNNING', lastSeq: 0,
  snapshot: {language: 'printscript', version: '1.1', codeHash: 'sha256-v1:' + 'a'.repeat(64)},
  limits: {totalSeconds: 120, inputWaitSeconds: 30, reconnectSeconds: 15, codeBytes: 1048576, inputBytes: 8192, outputBytes: 3, bufferBytes: 262144, bufferEvents: 256, terminalRetentionSeconds: 60}};
describe('immutable execution progression', () => {
  it('returns a new state, preserves the previous snapshot and counts UTF-8 bytes rather than characters', () => {
    const previous = {...idleExecution, descriptor, phase: 'RUNNING' as const, lastSeq: 1};
    const result = applyExecutionEvent(previous, {executionId, seq: 2, type: 'output', data: {text: 'ñ'}});
    expect(previous.outputs).toEqual([]); expect(previous.lastSeq).toBe(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view).toMatchObject({outputs: ['ñ'], outputBytes: 2, lastSeq: 2});
    expect(applyExecutionEvent(result.view, {executionId, seq: 3, type: 'output', data: {text: 'ñ'}})).toEqual({ok: false, reason: 'output-limit'});
  });
  it('rejects an input acknowledgment for another prompt as data, without mutating the pending request', () => {
    const previous = {...idleExecution, descriptor, phase: 'WAITING_INPUT' as const, lastSeq: 2, prompt: {requestId: 'expected', prompt: 'Valor?'}};
    expect(applyExecutionEvent(previous, {executionId, seq: 3, type: 'input-accepted', data: {requestId: 'other'}})).toEqual({ok: false, reason: 'invalid-event'});
    expect(previous.prompt.requestId).toBe('expected');
  });
  it('does not undo a pending cancellation when a late started/input event arrives', () => {
    const previous = {...idleExecution, descriptor, phase: 'CANCELLING' as const};
    const started = applyExecutionEvent(previous, {executionId, seq: 1, type: 'started', data: {mode: 'INTERACTIVE'}});
    expect(started.ok && started.view.phase).toBe('CANCELLING');
    if (!started.ok) return;
    const input = applyExecutionEvent(started.view, {executionId, seq: 2, type: 'input-required', data: {requestId: 'prompt', prompt: 'Valor?'}});
    expect(input.ok && input.view.phase).toBe('CANCELLING');
  });
});

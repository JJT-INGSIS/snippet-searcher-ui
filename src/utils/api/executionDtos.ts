import {Diagnostic} from './errors';

export type ExecutionTarget = {snippetId: string; testId?: string};
export const targetKey = (target: ExecutionTarget) => target.snippetId + ':' + (target.testId ?? 'interactive');
export type ExecutionMode = 'TEST' | 'INTERACTIVE';
export const outcomes = ['COMPLETED', 'PROGRAM_ERROR', 'INPUT_EXHAUSTED', 'LIMIT_EXCEEDED', 'CANCELLED', 'TECHNICAL_FAILURE', 'INTERRUPTED'] as const;
export type Outcome = typeof outcomes[number];
export type ServerState = 'STARTING' | 'RUNNING' | 'WAITING_INPUT' | 'CANCELLING' | Outcome;
export const isTerminal = (state: string): state is Outcome => (outcomes as readonly string[]).includes(state);
export type ExecutionLimits = {totalSeconds: number; inputWaitSeconds: number; reconnectSeconds: number; codeBytes: number; inputBytes: number; outputBytes: number; bufferEvents: number; bufferBytes: number; terminalRetentionSeconds: number};
export type ExecutionDescriptor = ExecutionTarget & {
  executionId: string; mode: ExecutionMode; state: ServerState; lastSeq: number;
  snapshot: {language: string; version: string; codeHash: string; testHash?: string}; limits: ExecutionLimits;
};
export type Terminal = {outcome: Outcome; reason: string; comparison?: 'PASSED' | 'FAILED'; unusedInputs?: number; diagnostics?: Diagnostic[]};
export type ExecutionEvent = {executionId: string; seq: number} & (
  {type: 'started'; data: {mode: ExecutionMode}} |
  {type: 'output'; data: {text: string}} |
  {type: 'input-required'; data: {requestId: string; prompt: string}} |
  {type: 'input-accepted'; data: {requestId: string}} |
  {type: 'heartbeat'; data: Record<string, never>} |
  {type: 'terminal'; data: Terminal}
);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash = /^sha256-v1:[0-9a-f]{64}$/;
export const protocolError = () => new Error('Respuesta de ejecución inválida. No se pudo confirmar el resultado.');
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw protocolError();
  return value as Record<string, unknown>;
};
const integer = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const id = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const state = (value: unknown): value is ServerState => typeof value === 'string' && (isTerminal(value) || ['STARTING', 'RUNNING', 'WAITING_INPUT', 'CANCELLING'].includes(value));

export function fromExecutionDescriptor(value: unknown, target: ExecutionTarget, executionId?: string): ExecutionDescriptor {
  const dto = record(value), snapshot = record(dto.snapshot), limits = record(dto.limits);
  const mode = target.testId ? 'TEST' : 'INTERACTIVE';
  if (!id(dto.executionId) || (executionId && dto.executionId !== executionId) || dto.snippetId !== target.snippetId ||
      dto.testId !== target.testId || dto.mode !== mode || !state(dto.state) || !integer(dto.lastSeq) ||
      typeof snapshot.language !== 'string' || typeof snapshot.version !== 'string' ||
      typeof snapshot.codeHash !== 'string' || !hash.test(snapshot.codeHash) ||
      (mode === 'TEST' && (typeof snapshot.testHash !== 'string' || !hash.test(snapshot.testHash))) ||
      !['totalSeconds', 'inputWaitSeconds', 'reconnectSeconds', 'codeBytes', 'inputBytes', 'outputBytes', 'bufferEvents', 'bufferBytes', 'terminalRetentionSeconds']
        .every(key => integer(limits[key], 1))) throw protocolError();
  return dto as ExecutionDescriptor;
}

export function fromExecutionEvent(value: unknown, descriptor: ExecutionDescriptor): ExecutionEvent {
  const dto = record(value), data = record(dto.data);
  if (dto.executionId !== descriptor.executionId || !integer(dto.seq, 1)) throw protocolError();
  switch (dto.type) {
    case 'started': if (dto.seq !== 1 || data.mode !== descriptor.mode) throw protocolError(); break;
    case 'output': if (typeof data.text !== 'string') throw protocolError(); break;
    case 'input-required':
      if (descriptor.mode !== 'INTERACTIVE' || !id(data.requestId) || typeof data.prompt !== 'string') throw protocolError(); break;
    case 'input-accepted': if (descriptor.mode !== 'INTERACTIVE' || !id(data.requestId)) throw protocolError(); break;
    case 'heartbeat': if (Object.keys(data).length) throw protocolError(); break;
    case 'terminal':
      if (typeof data.outcome !== 'string' || !isTerminal(data.outcome) || typeof data.reason !== 'string' || !data.reason ||
          (descriptor.mode === 'TEST' && data.outcome === 'COMPLETED' ? !['PASSED', 'FAILED'].includes(String(data.comparison)) : data.comparison !== undefined) ||
          (data.unusedInputs !== undefined && !integer(data.unusedInputs)) ||
          (data.diagnostics !== undefined && (!Array.isArray(data.diagnostics) || !data.diagnostics.every(item => {
            const diagnostic = record(item);
            return typeof diagnostic.rule === 'string' && typeof diagnostic.message === 'string' && integer(diagnostic.line, 1) && integer(diagnostic.column, 1);
          })))) throw protocolError();
      break;
    default: throw protocolError();
  }
  return dto as ExecutionEvent;
}

export function fromCancel(value: unknown): ServerState {
  const dto = record(value);
  if (!state(dto.state) || (!isTerminal(dto.state) && dto.state !== 'CANCELLING')) throw protocolError();
  return dto.state;
}

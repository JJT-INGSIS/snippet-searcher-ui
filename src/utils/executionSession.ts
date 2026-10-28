import {ExecutionHttp} from './api/executionHttp';
import {ApiError} from './api/errors';
import {ExecutionDescriptor, ExecutionEvent, ExecutionTarget, isTerminal, protocolError, targetKey} from './api/executionDtos';
import {ExecutionView, applyExecutionEvent, idleExecution} from './executionState';
export {idleExecution} from './executionState';
const message = (error: unknown) => error instanceof Error ? error.message : 'No se pudo confirmar la ejecución.';

/** One actor-scoped owner for TEST and INTERACTIVE, including in-flight starts/cancels.
 * This is UI coordination; authoritative capacity and authorization remain in Snippets. */
export class ExecutionSession {
  private view: ExecutionView = idleExecution;
  private readonly listeners = new Set<() => void>();
  private generation = 0;
  private stream?: AbortController;
  private mutation?: AbortController;
  private readingGeneration?: number;
  private startedAt = 0;
  private readonly submitted = new Map<string, string>();
  constructor(private readonly http: ExecutionHttp) {}
  getSnapshot = () => this.view;
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  private publish(update: Partial<ExecutionView>) {this.view = {...this.view, ...update}; this.listeners.forEach(listener => listener());}
  private owned(target: ExecutionTarget) {return !!this.view.target && targetKey(this.view.target) === targetKey(target);}
  private occupied() {return this.view.phase !== 'IDLE' && !isTerminal(this.view.phase) && !this.view.startUncertain && !this.view.unavailable;}
  private lostAccess(error: unknown) {
    return error instanceof ApiError && [401, 403, 404].includes(error.problem?.status ?? 0)
      ? {outputs: [], prompt: undefined, unavailable: true} : {};
  }
  async start(target: ExecutionTarget) {
    if (this.occupied() || (this.view.startUncertain && !this.owned(target))) return;
    const generation = ++this.generation;
    this.startedAt = Date.now();
    this.stream?.abort(); this.mutation?.abort(); this.submitted.clear();
    this.view = {...idleExecution, target, phase: 'STARTING', connecting: true}; this.publish({});
    const controller = new AbortController(); this.stream = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const descriptor = await this.http.start(target, controller.signal);
      // A late successful start still requires cancellation after its panel has gone away.
      if (generation !== this.generation) {void this.cancelDetached(descriptor); return;}
      clearTimeout(timeout);
      this.publish({descriptor, phase: descriptor.state, connecting: false});
      await this.read(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      const rejected = error instanceof ApiError && !error.uncertain;
      this.publish({phase: rejected ? 'IDLE' : 'UNKNOWN', connecting: false,
        startUncertain: !rejected, message: rejected ? message(error) : 'No sabemos si el servidor inició la ejecución. No se repetirá automáticamente. ' + message(error)});
    } finally {clearTimeout(timeout);}
  }
  private accept(event: ExecutionEvent) {
    const result = applyExecutionEvent(this.view, event);
    if (!result.ok) throw protocolError(); // Convert at the streaming I/O boundary.
    this.publish(result.view);
  }
  private async read(generation: number) {
    const descriptor = this.view.descriptor;
    if (!descriptor) return;
    const controller = new AbortController(); this.stream = controller;
    this.readingGeneration = generation;
    // A reconnect may retrieve a retained terminal after the execution deadline.
    // The server owns the execution deadline; this only bounds the browser read.
    const remaining = this.startedAt + descriptor.limits.totalSeconds * 1000 - Date.now();
    const timeout = setTimeout(() => controller.abort(), Math.max(descriptor.limits.reconnectSeconds * 1000, remaining));
    this.publish({connecting: true, message: undefined});
    try {
      await this.http.events(descriptor, this.view.lastSeq, controller.signal, event => {
        if (generation === this.generation) {this.publish({connecting: false}); this.accept(event);}
      });
      if (generation === this.generation && !isTerminal(this.view.phase)) this.publish({phase: 'UNKNOWN', message: 'Se cortó la conexión sin resultado final. La ejecución podría seguir activa.'});
    } catch (error) {
      if (generation === this.generation && !isTerminal(this.view.phase)) {
        this.publish({phase: 'UNKNOWN', ...this.lostAccess(error), message: message(error)});
      }
    } finally {
      clearTimeout(timeout);
      if (this.readingGeneration === generation) this.readingGeneration = undefined;
      if (generation === this.generation) this.publish({connecting: false});
    }
  }
  async reconnect(target: ExecutionTarget) {
    if (!this.owned(target) || !this.view.descriptor || this.view.connecting || this.view.terminal) return;
    this.stream?.abort();
    const generation = ++this.generation, controller = new AbortController(); this.stream = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    this.publish({connecting: true});
    try {
      const descriptor = await this.http.describe(this.view.descriptor, controller.signal);
      if (generation !== this.generation) return;
      this.publish({descriptor, phase: descriptor.state});
      clearTimeout(timeout);
      await this.read(generation);
    } catch (error) {
      if (generation === this.generation) this.publish({phase: 'UNKNOWN', connecting: false, ...this.lostAccess(error), message: message(error)});
    } finally {clearTimeout(timeout);}
  }
  async input(target: ExecutionTarget, value: string) {
    const {descriptor, prompt} = this.view;
    if (!this.owned(target) || !descriptor || !prompt || this.view.sending || this.view.phase !== 'WAITING_INPUT') return;
    const previous = this.submitted.get(prompt.requestId);
    if (previous !== undefined && previous !== value) {this.publish({message: 'La entrega anterior es incierta. Reenviá el mismo valor para este input.'}); return;}
    if (new TextEncoder().encode(value).length > descriptor.limits.inputBytes) {this.publish({message: 'El input supera el límite de ' + descriptor.limits.inputBytes + ' bytes UTF-8.'}); return;}
    const generation = this.generation, controller = new AbortController(); this.mutation = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    this.submitted.set(prompt.requestId, value); this.publish({sending: true, message: undefined});
    try {await this.http.input(descriptor.executionId, prompt.requestId, value, controller.signal);}
    catch (error) {if (generation === this.generation && this.view.prompt?.requestId === prompt.requestId) {
      const denied = this.lostAccess(error);
      this.publish({sending: false, ...denied, ...(denied.unavailable ? {phase: 'UNKNOWN'} : {}), message: 'No se confirmó el input. ' + message(error)});
    }}
    finally {clearTimeout(timeout);}
    // Only input-accepted advances the prompt. A POST acknowledgment can arrive late.
  }
  async cancel(target: ExecutionTarget) {
    if (!this.owned(target) || !this.view.descriptor || isTerminal(this.view.phase) || this.view.phase === 'CANCELLING') return;
    const generation = this.generation, descriptor = this.view.descriptor, controller = new AbortController();
    this.mutation?.abort(); this.mutation = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    this.publish({phase: 'CANCELLING', sending: false, message: 'Cancelación solicitada; esperando confirmación de que terminó.'});
    try {
      const state = await this.http.cancel(descriptor.executionId, controller.signal);
      if (generation === this.generation && !this.view.terminal) {
        if (isTerminal(state)) this.publish({phase: state, prompt: undefined, message: 'El servidor confirmó ' + state + '. No se recuperó el detalle del resultado.'});
        else if (this.readingGeneration !== generation) this.publish({phase: 'UNKNOWN', message: 'Cancelación solicitada. Reconectá para confirmar el resultado final.'});
      }
    } catch (error) {if (generation === this.generation && !this.view.terminal) this.publish({phase: 'UNKNOWN', ...this.lostAccess(error), message: 'No se confirmó la cancelación. ' + message(error)});}
    finally {clearTimeout(timeout);}
  }
  close(target: ExecutionTarget) {
    if (!this.owned(target)) return;
    const descriptor = this.view.descriptor, active = this.occupied();
    ++this.generation; this.stream?.abort(); this.mutation?.abort();
    if (isTerminal(this.view.phase) || this.view.phase === 'IDLE') {this.view = idleExecution; this.publish({}); return;}
    // Do not carry private output or input into a newly opened panel.
    this.publish({outputs: [], connecting: false, sending: false});
    if (active && descriptor) {
      this.publish({phase: 'UNKNOWN', message: 'Se cerró el panel y se solicitó cancelar. Falta confirmar el resultado.'});
      void this.cancelDetached(descriptor);
    } else if (active) {
      this.publish({phase: 'UNKNOWN', startUncertain: true, message: 'El inicio quedó sin confirmar al cerrar el panel. Puede seguir activo.'});
    }
  }
  private async cancelDetached(descriptor: ExecutionDescriptor) {
    const generation = this.generation, controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const state = await this.http.cancel(descriptor.executionId, controller.signal);
      if (generation === this.generation && this.view.descriptor?.executionId === descriptor.executionId && isTerminal(state)) this.publish({phase: state, message: 'El servidor confirmó ' + state + '.'});
    } catch (error) {
      if (generation === this.generation && this.view.descriptor?.executionId === descriptor.executionId) this.publish({...this.lostAccess(error)});
      // Keep UNKNOWN: closing HTTP is not evidence that computation stopped.
    }
    finally {clearTimeout(timeout);}
  }
}

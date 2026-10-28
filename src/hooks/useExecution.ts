import {useEffect, useSyncExternalStore} from 'react';
import {useApi} from '../contexts/apiContext';
import {ExecutionTarget, isTerminal, targetKey} from '../utils/api/executionDtos';
import {idleExecution} from '../utils/executionSession';

export function useExecution(target: ExecutionTarget) {
  const {execution} = useApi();
  const snapshot = useSyncExternalStore(execution.subscribe, execution.getSnapshot);
  const {snippetId, testId} = target;
  useEffect(() => () => execution.close({snippetId, testId}), [execution, snippetId, testId]);
  const own = snapshot.target && targetKey(snapshot.target) === targetKey(target);
  const occupied = snapshot.phase !== 'IDLE' && !isTerminal(snapshot.phase) && !snapshot.unavailable;
  return {
    view: own ? snapshot : idleExecution,
    blocked: !own && occupied,
    start: () => execution.start(target),
    input: (value: string) => execution.input(target, value),
    cancel: () => execution.cancel(target),
    reconnect: () => execution.reconnect(target),
  };
}

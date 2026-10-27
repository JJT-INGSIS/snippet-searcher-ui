import {CreateSnippet} from '../snippet';
export type CreationIntent = Readonly<{key: string; actorId: string; payload: Readonly<CreateSnippet>}>;
// Owned by the form, across uncertain retries. Never regenerate inside HTTP code.
export function createCreationIntent(input: CreateSnippet, actorId: string,
  newKey: () => string = () => crypto.randomUUID()): CreationIntent {
  return Object.freeze({key: newKey(), actorId, payload: Object.freeze({...input})});
}

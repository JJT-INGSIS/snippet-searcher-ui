import {useEffect, useRef, useState} from 'react';
import {CreateSnippet, SnippetDraft} from '../utils/snippet';
import {CreationIntent, createCreationIntent} from '../utils/api/creationIntent';
import {ApiError} from '../utils/api/errors';
import {useApi} from '../contexts/apiContext';
import {useCreateSnippet} from '../utils/queries';

const empty: CreateSnippet = {name: '', description: null, language: '', version: '', content: ''};
export function useSnippetCreation(open: boolean, defaults: SnippetDraft | undefined, onSaved: () => void) {
  const [draft, setDraft] = useState<CreateSnippet>(empty);
  const [error, setError] = useState<Error | null>(null);
  const intent = useRef<CreationIntent>();
  const submitting = useRef(false);
  const {actor} = useApi();
  const mutation = useCreateSnippet();
  useEffect(() => {
    if (open && !intent.current) {
      setDraft({...empty, ...defaults});
      setError(null);
    }
  }, [open, defaults]);
  const uncertain = error instanceof ApiError && error.uncertain;
  async function save() {
    if (submitting.current || !draft.name.trim() || !draft.language || !draft.version) return;
    submitting.current = true;
    if (!intent.current) intent.current = createCreationIntent(draft, actor);
    try {
      await mutation.mutateAsync(intent.current);
      intent.current = undefined;
      setError(null);
      onSaved();
    } catch (cause) {
      const failure = cause instanceof ApiError ? cause : new ApiError('Unconfirmed creation', undefined, true);
      setError(failure);
      if (!failure.uncertain) intent.current = undefined;
    } finally {submitting.current = false;}
  }
  return {
    draft, error, uncertain, saving: mutation.isLoading, locked: mutation.isLoading || uncertain, save,
    change: (change: Partial<CreateSnippet>) => {
      if (!submitting.current && !uncertain) setDraft(previous => ({...previous, ...change}));
    },
  };
}

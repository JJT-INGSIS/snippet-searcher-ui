import {useEffect, useRef, useState} from 'react';
import {Snippet, UpdateSnippet} from '../utils/snippet';
import {useUpdateSnippetById} from '../utils/queries';

type Draft = Pick<UpdateSnippet, 'name' | 'description' | 'content'>;
export function useSnippetEditor(id: string, snippet: Snippet | undefined) {
  const [draft, setDraft] = useState<Draft>({name: '', description: null, content: ''});
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);
  const submitting = useRef(false);
  const mutation = useUpdateSnippetById();
  useEffect(() => {
    if (snippet && !hydrated.current) {
      setDraft({name: snippet.name, description: snippet.description, content: snippet.content});
      hydrated.current = true;
    }
  }, [snippet]);
  async function save() {
    if (!snippet?.capabilities.modify || !draft.name.trim() || submitting.current) return;
    submitting.current = true; setSaved(false);
    try {
      await mutation.mutateAsync({id, updateSnippet: {...draft, language: snippet.language, version: snippet.version}});
      setSaved(true);
    } catch { /* Keep the draft; the mutation exposes the failure to the view. */ }
    finally {submitting.current = false;}
  }
  return {
    draft, saved, save, saving: mutation.isLoading,
    error: mutation.error instanceof Error ? mutation.error : null,
    change: (change: Partial<Draft>) => {
      if (submitting.current) return;
      setDraft(previous => ({...previous, ...change}));
      setSaved(false); mutation.reset();
    },
  };
}

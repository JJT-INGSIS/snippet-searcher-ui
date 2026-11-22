import {useEffect, useRef, useState} from 'react';
import {Snippet, SnippetDraft, UpdateSnippet, versionsOf} from '../utils/snippet';
import {useGetFileTypes, useUpdateSnippetById} from '../utils/queries';
import {editDraftOf, emptyEditDraft, hasChanges, isSavable, withLanguage, withUploadedFile} from '../utils/snippetEditDraft';

export type SnippetEditor = ReturnType<typeof useSnippetEditor>;

export function useSnippetEditor(id: string, snippet: Snippet | undefined) {
  const [draft, setDraft] = useState<UpdateSnippet>(emptyEditDraft);
  const [saved, setSaved] = useState(false);
  const hydrated = useRef(false);
  const submitting = useRef(false);
  const mutation = useUpdateSnippetById();
  const {data: types} = useGetFileTypes();
  useEffect(() => {
    if (snippet && !hydrated.current) {
      setDraft(editDraftOf(snippet));
      hydrated.current = true;
    }
  }, [snippet]);
  const savable = !!snippet && isSavable(draft, snippet, versionsOf(types, draft.language));
  function save() {
    if (!snippet?.capabilities.modify || !savable || submitting.current) return;
    submitting.current = true; setSaved(false);
    mutation.mutate({id, updateSnippet: draft}, {
      onSuccess: () => setSaved(true),
      onSettled: () => {submitting.current = false;},
    });
  }
  function update(next: (current: UpdateSnippet) => UpdateSnippet) {
    if (submitting.current) return;
    setDraft(next); setSaved(false); mutation.reset();
  }
  return {
    draft, saved, savable, save, saving: mutation.isLoading,
    dirty: hydrated.current && !!snippet && hasChanges(draft, snippet),
    error: mutation.error instanceof Error ? mutation.error : null,
    change: (change: Partial<UpdateSnippet>) => update(current => ({...current, ...change})),
    chooseLanguage: (language: string) => update(current => withLanguage(current, language)),
    loadFile: (file: SnippetDraft) => update(current => withUploadedFile(current, file)),
  };
}

import {useEffect, useRef, useState} from 'react';
import {Snippet, SnippetDraft, UpdateSnippet, catalogVersionsForLanguage} from '../utils/snippet';
import {useGetFileTypes, useUpdateSnippetById} from '../utils/queries';
import {canSaveEditDraft, editDraftFromSavedSnippet, emptySnippetEditDraft, hasUnsavedChanges, withChangedLanguage, withCodeFromUploadedFile} from '../utils/snippetEditDraft';

export type SnippetEditor = ReturnType<typeof useSnippetEditor>;

export function useSnippetEditor(id: string, snippet: Snippet | undefined) {
  const [draft, setDraft] = useState<UpdateSnippet>(emptySnippetEditDraft);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const draftLoadedFromSnippet = useRef(false);
  const submissionInProgress = useRef(false);
  const updateSnippetMutation = useUpdateSnippetById();
  const {data: languageCatalog} = useGetFileTypes();
  useEffect(() => {
    if (snippet && !draftLoadedFromSnippet.current) {
      setDraft(editDraftFromSavedSnippet(snippet));
      draftLoadedFromSnippet.current = true;
    }
  }, [snippet]);
  const canSave = !!snippet && canSaveEditDraft(draft, snippet, catalogVersionsForLanguage(languageCatalog, draft.language));
  function save() {
    if (!snippet?.capabilities.modify || !canSave || submissionInProgress.current) return;
    submissionInProgress.current = true; setSavedSuccessfully(false);
    updateSnippetMutation.mutate({id, updateSnippet: draft}, {
      onSuccess: () => setSavedSuccessfully(true),
      onSettled: () => {submissionInProgress.current = false;},
    });
  }
  function updateDraft(transformDraft: (current: UpdateSnippet) => UpdateSnippet) {
    if (submissionInProgress.current) return;
    setDraft(transformDraft); setSavedSuccessfully(false); updateSnippetMutation.reset();
  }
  return {
    draft, savedSuccessfully, canSave, save, isSaving: updateSnippetMutation.isLoading,
    hasUnsavedChanges: draftLoadedFromSnippet.current && !!snippet && hasUnsavedChanges(draft, snippet),
    error: updateSnippetMutation.error instanceof Error ? updateSnippetMutation.error : null,
    changeFields: (changedFields: Partial<UpdateSnippet>) => updateDraft(current => ({...current, ...changedFields})),
    changeLanguage: (language: string) => updateDraft(current => withChangedLanguage(current, language)),
    loadCodeFromFile: (file: SnippetDraft) => updateDraft(current => withCodeFromUploadedFile(current, file)),
  };
}

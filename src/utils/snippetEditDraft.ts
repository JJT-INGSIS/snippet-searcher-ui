import {SnippetDraft, UpdateSnippet} from './snippet';

const EDITABLE_FIELDS: (keyof UpdateSnippet)[] = ['name', 'description', 'language', 'version', 'content'];

export const emptySnippetEditDraft: UpdateSnippet = {name: '', description: null, language: '', version: '', content: ''};

export function editDraftFromSavedSnippet(saved: UpdateSnippet): UpdateSnippet {
  return {name: saved.name, description: saved.description, language: saved.language, version: saved.version, content: saved.content};
}

export function withChangedLanguage(draft: UpdateSnippet, language: string): UpdateSnippet {
  return language === draft.language ? draft : {...draft, language, version: ''};
}

export function withCodeFromUploadedFile(draft: UpdateSnippet, file: SnippetDraft): UpdateSnippet {
  return {...withChangedLanguage(draft, file.language), content: file.content};
}

export function hasUnsavedChanges(draft: UpdateSnippet, saved: UpdateSnippet): boolean {
  return EDITABLE_FIELDS.some(field => draft[field] !== saved[field]);
}

export function canSaveEditDraft(draft: UpdateSnippet, saved: UpdateSnippet, catalogVersions: string[]): boolean {
  const keepsSavedLanguageAndVersion = draft.language === saved.language && draft.version === saved.version;
  return draft.name.trim().length > 0 && (keepsSavedLanguageAndVersion || catalogVersions.includes(draft.version));
}

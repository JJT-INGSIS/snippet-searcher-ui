import {SnippetDraft, UpdateSnippet} from './snippet';

const EDITABLE_FIELDS: (keyof UpdateSnippet)[] = ['name', 'description', 'language', 'version', 'content'];

export const emptyEditDraft: UpdateSnippet = {name: '', description: null, language: '', version: '', content: ''};

export function editDraftOf(saved: UpdateSnippet): UpdateSnippet {
  return {name: saved.name, description: saved.description, language: saved.language, version: saved.version, content: saved.content};
}

export function withLanguage(draft: UpdateSnippet, language: string): UpdateSnippet {
  return language === draft.language ? draft : {...draft, language, version: ''};
}

export function withUploadedFile(draft: UpdateSnippet, file: SnippetDraft): UpdateSnippet {
  return {...withLanguage(draft, file.language), content: file.content};
}

export function hasChanges(draft: UpdateSnippet, saved: UpdateSnippet): boolean {
  return EDITABLE_FIELDS.some(field => draft[field] !== saved[field]);
}

export function isSavable(draft: UpdateSnippet, saved: UpdateSnippet, versions: string[]): boolean {
  const keepsLanguage = draft.language === saved.language && draft.version === saved.version;
  return draft.name.trim().length > 0 && (keepsLanguage || versions.includes(draft.version));
}

import {describe, expect, it} from 'vitest';
import {editDraftFromSavedSnippet, hasUnsavedChanges, canSaveEditDraft, withChangedLanguage, withCodeFromUploadedFile} from './snippetEditDraft';
import {UpdateSnippet} from './snippet';

const saved: UpdateSnippet = {name: 'Hello', description: null, language: 'printscript', version: '1.0', content: 'println(1);'};
const catalogVersions = ['1.0', '1.1'];

describe('snippet edit draft', () => {
  it('starts from the saved snippet and is unchanged until a field differs', () => {
    const draft = editDraftFromSavedSnippet({...saved, extension: 'prs'} as UpdateSnippet);

    expect(draft).toEqual(saved);
    expect(hasUnsavedChanges(draft, saved)).toBe(false);
    expect(hasUnsavedChanges({...draft, version: '1.1'}, saved)).toBe(true);
  });

  it('clears the version only when the language actually changes', () => {
    expect(withChangedLanguage(saved, 'printscript')).toBe(saved);
    expect(withChangedLanguage(saved, 'otherscript')).toEqual({...saved, language: 'otherscript', version: ''});
  });

  it('replaces only the code from a file and keeps name and description', () => {
    const sameLanguage = withCodeFromUploadedFile(saved, {name: 'nuevo', language: 'printscript', content: 'println(5);'});
    const otherLanguage = withCodeFromUploadedFile(saved, {name: 'nuevo', language: 'otherscript', content: 'print 5'});

    expect(sameLanguage).toEqual({...saved, content: 'println(5);'});
    expect(otherLanguage).toEqual({...saved, language: 'otherscript', version: '', content: 'print 5'});
  });

  it('never changes the previous draft', () => {
    const draft = editDraftFromSavedSnippet(saved);

    withCodeFromUploadedFile(withChangedLanguage(draft, 'otherscript'), {name: 'x', language: 'otherscript', content: 'x'});

    expect(draft).toEqual(saved);
  });

  it('requires a name and a catalog version unless language and version are the saved ones', () => {
    expect(canSaveEditDraft({...saved, name: 'Renamed'}, saved, [])).toBe(true);
    expect(canSaveEditDraft({...saved, name: '  '}, saved, catalogVersions)).toBe(false);
    expect(canSaveEditDraft({...saved, version: '1.1'}, saved, catalogVersions)).toBe(true);
    expect(canSaveEditDraft({...saved, version: '9.9'}, saved, catalogVersions)).toBe(false);
    expect(canSaveEditDraft(withChangedLanguage(saved, 'otherscript'), saved, ['2.0'])).toBe(false);
  });

  it('requires an actual difference and disables saving again after reverting or accepting the saved draft', () => {
    expect(canSaveEditDraft(editDraftFromSavedSnippet(saved), saved, catalogVersions)).toBe(false);
    const changed = {...saved, content: 'println(2);'};
    expect(canSaveEditDraft(changed, saved, catalogVersions)).toBe(true);
    expect(canSaveEditDraft({...changed, content: saved.content}, saved, catalogVersions)).toBe(false);
    expect(canSaveEditDraft(changed, changed, catalogVersions)).toBe(false);
  });

  it('detects changes in each editable field without trimming or merging null and empty descriptions', () => {
    const changes: Partial<UpdateSnippet>[] = [
      {name: 'Hello '}, {description: ''}, {description: 'Description'},
      {content: 'println(2);'}, {version: '1.1'}, {language: 'otherscript', version: '2.0'},
    ];
    for (const change of changes) {
      expect(canSaveEditDraft({...saved, ...change}, saved, ['1.0', '1.1', '2.0'])).toBe(true);
    }
  });
});

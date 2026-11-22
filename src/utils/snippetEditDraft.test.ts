import {describe, expect, it} from 'vitest';
import {editDraftOf, hasChanges, isSavable, withLanguage, withUploadedFile} from './snippetEditDraft';
import {UpdateSnippet} from './snippet';

const saved: UpdateSnippet = {name: 'Hello', description: null, language: 'printscript', version: '1.0', content: 'println(1);'};
const catalogVersions = ['1.0', '1.1'];

describe('snippet edit draft', () => {
  it('starts from the saved snippet and is unchanged until a field differs', () => {
    const draft = editDraftOf({...saved, extension: 'prs'} as UpdateSnippet);

    expect(draft).toEqual(saved);
    expect(hasChanges(draft, saved)).toBe(false);
    expect(hasChanges({...draft, version: '1.1'}, saved)).toBe(true);
  });

  it('clears the version only when the language actually changes', () => {
    expect(withLanguage(saved, 'printscript')).toBe(saved);
    expect(withLanguage(saved, 'otherscript')).toEqual({...saved, language: 'otherscript', version: ''});
  });

  it('replaces only the code from a file and keeps name and description', () => {
    const sameLanguage = withUploadedFile(saved, {name: 'nuevo', language: 'printscript', content: 'println(5);'});
    const otherLanguage = withUploadedFile(saved, {name: 'nuevo', language: 'otherscript', content: 'print 5'});

    expect(sameLanguage).toEqual({...saved, content: 'println(5);'});
    expect(otherLanguage).toEqual({...saved, language: 'otherscript', version: '', content: 'print 5'});
  });

  it('never changes the previous draft', () => {
    const draft = editDraftOf(saved);

    withUploadedFile(withLanguage(draft, 'otherscript'), {name: 'x', language: 'otherscript', content: 'x'});

    expect(draft).toEqual(saved);
  });

  it('requires a name and a catalog version unless language and version are the saved ones', () => {
    expect(isSavable(saved, saved, [])).toBe(true);
    expect(isSavable({...saved, name: '  '}, saved, catalogVersions)).toBe(false);
    expect(isSavable({...saved, version: '1.1'}, saved, catalogVersions)).toBe(true);
    expect(isSavable({...saved, version: '9.9'}, saved, catalogVersions)).toBe(false);
    expect(isSavable(withLanguage(saved, 'otherscript'), saved, ['2.0'])).toBe(false);
  });
});

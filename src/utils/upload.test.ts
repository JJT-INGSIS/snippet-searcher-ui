import {describe, expect, it} from 'vitest';
import {readSnippetFile} from './upload';
const types = [{language: 'printscript', extension: 'prs', versions: ['1.0', '1.1']}];
describe('uploaded snippet drafts', () => {
  it('recognizes uppercase extensions, preserves dotted names and exact code without inventing a version', async () => {
    const file = new File(['\uFEFFprintln(1);\r\n'], 'mi.ejemplo.PRS');
    const draft = await readSnippetFile(file, types);
    expect(draft).toEqual({name: 'mi.ejemplo', language: 'printscript', content: '\uFEFFprintln(1);\r\n'});
    expect(draft).not.toHaveProperty('version');
  });
  it('accepts empty code but rejects extensions absent from the real catalog', async () => {
    expect((await readSnippetFile(new File([''], 'empty.prs'), types)).content).toBe('');
    await expect(readSnippetFile(new File(['x'], 'example.js'), types)).rejects.toThrow('extensión');
    await expect(readSnippetFile(new File(['x'], 'example.prs'), [])).rejects.toThrow('extensión');
  });
});

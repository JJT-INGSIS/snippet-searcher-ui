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
  it('rejects an empty file and extensions absent from the real catalog', async () => {
    for (const code of ['', ' \t\r\n']) {
      await expect(readSnippetFile(new File([code], 'empty.prs'), types)).rejects.toThrow('vacío');
    }
    await expect(readSnippetFile(new File(['x'], 'example.js'), types)).rejects.toThrow('extensión');
    await expect(readSnippetFile(new File(['x'], 'example.prs'), [])).rejects.toThrow('extensión');
  });
});

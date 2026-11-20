import {describe, expect, it} from 'vitest';
import {formattedFileName, fromFormattedSnippetDto} from './formattedSnippet';

const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const revision = 'sha256-v1:' + 'a'.repeat(64);
const processor = 'sha256-v1:' + 'e'.repeat(64);
const code = 'let saludo: string = "¡Hola, señor! 🚀";\r\nprintln(saludo);\n';
const dto = {
  snippetId, name: 'Saludo', language: 'printscript', version: '1.1', extension: 'prs', code,
  source: 'stored', rulesRevision: revision, processorRevision: processor,
};

describe('formatted snippet contract', () => {
  it('keeps the formatted code exactly with the name and extension to save it', () => {
    expect(fromFormattedSnippetDto(dto, snippetId)).toEqual(dto);
  });

  it('accepts a variant formatted on demand', () => {
    expect(fromFormattedSnippetDto({...dto, source: 'on-demand'}, snippetId).source).toBe('on-demand');
  });

  it.each([
    ['another snippet', {...dto, snippetId: '770e8400-e29b-41d4-a716-446655440001'}],
    ['an unknown source', {...dto, source: 'cache'}],
    ['code that is not text', {...dto, code: null}],
    ['an empty name', {...dto, name: ''}],
    ['an extension with a dot', {...dto, extension: '.prs'}],
    ['a malformed rules revision', {...dto, rulesRevision: 'v1'}],
    ['a malformed processor revision', {...dto, processorRevision: '1.1'}],
    ['a missing version', {...dto, version: undefined}],
    ['no object', 'let a = 1;'],
  ])('rejects %s instead of downloading it', (_, value) => {
    expect(() => fromFormattedSnippetDto(value, snippetId)).toThrow();
  });

  it('names the file after the snippet with the real extension', () => {
    expect(formattedFileName({name: 'Saludo', extension: 'prs'})).toBe('Saludo-formateado.prs');
    expect(formattedFileName({name: 'mi snippet ñ', extension: 'prs'})).toBe('mi snippet ñ-formateado.prs');
  });
});

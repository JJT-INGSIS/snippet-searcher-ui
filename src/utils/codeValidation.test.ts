import {describe, expect, it} from 'vitest';
import {snippetCodeError} from './codeValidation';

describe('blank snippet code contract', () => {
  it.each(['', ' ', '\t', '\r\n', ' \t\r\n', '\u00a0', '\u2003'])('rejects blank code %j', code => {
    expect(snippetCodeError(code)).toContain('vacío');
  });
  it.each(['// comentario', '\uFEFFprintln(1);', '  println(1);\r\n', '\uFEFF', '\u0085'])('leaves nonblank code to language validation %j', code => {
    expect(snippetCodeError(code)).toBeUndefined();
  });
});

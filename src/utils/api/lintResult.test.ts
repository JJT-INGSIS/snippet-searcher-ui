import {describe, expect, it} from 'vitest';
import {fromLintDto} from './lintResult';

const revision = 'sha256-v1:' + 'b'.repeat(64);
const processor = 'sha256-v1:' + 'e'.repeat(64);
const diagnostic = {rule: 'identifier_format', message: 'El identificador debe ser camel case', line: 1, column: 5};
const evaluated = {codeHash: 'sha256-v1:' + 'c'.repeat(64), rulesRevision: revision, processorRevision: processor};
const empty = {diagnostics: [], codeHash: null, rulesRevision: null, processorRevision: null};

describe('lint result contract', () => {
  it('keeps the diagnostics of a snippet with violations exactly', () => {
    const lint = {status: 'not-compliant', reason: null, diagnostics: [diagnostic], ...evaluated};

    expect(fromLintDto(lint)).toEqual(lint);
  });

  it('keeps a compliant result and a technical failure apart', () => {
    expect(fromLintDto({status: 'compliant', reason: null, diagnostics: [], ...evaluated}).status).toBe('compliant');
    expect(fromLintDto({status: 'failed', reason: 'LINT_UNAVAILABLE', ...empty})).toMatchObject({status: 'failed', reason: 'LINT_UNAVAILABLE'});
  });

  it('keeps the reason of a result that is not evaluated or was superseded', () => {
    expect(fromLintDto({status: 'pending', reason: 'NOT_EVALUATED', ...empty}).reason).toBe('NOT_EVALUATED');
    expect(fromLintDto({status: 'pending', reason: 'SUPERSEDED', ...empty}).reason).toBe('SUPERSEDED');
  });

  it.each([
    ['the placeholder status', {status: 'not-implemented', reason: null, ...empty}],
    ['an unknown status', {status: 'skipped', reason: null, ...empty}],
    ['diagnostics on a pending result', {status: 'pending', reason: 'SUPERSEDED', ...empty, diagnostics: [diagnostic]}],
    ['diagnostics on a compliant result', {status: 'compliant', reason: null, diagnostics: [diagnostic], ...evaluated}],
    ['an evaluation without processor', {status: 'not-compliant', reason: null, diagnostics: [diagnostic], ...evaluated, processorRevision: null}],
    ['a diagnostic without position', {status: 'not-compliant', reason: null, diagnostics: [{...diagnostic, line: 0}], ...evaluated}],
    ['a diagnostic without message', {status: 'not-compliant', reason: null, diagnostics: [{...diagnostic, message: 3}], ...evaluated}],
    ['a malformed rules revision', {status: 'compliant', reason: null, diagnostics: [], ...evaluated, rulesRevision: 'r1'}],
    ['a reason that is not text', {status: 'failed', reason: 5, ...empty}],
    ['no lint at all', undefined],
  ])('rejects %s instead of showing it as a result', (_, value) => {
    expect(() => fromLintDto(value)).toThrow();
  });
});

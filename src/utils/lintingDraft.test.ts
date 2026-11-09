import {describe, expect, it} from 'vitest';
import {invalidLintInputs} from './lintingDraft';
import {draftOf, isDirty, withValue} from './formattingDraft';
import {LintRule} from './api/lintingRules';

const identifier: LintRule = {
  id: 'identifier_format', type: 'choice', acceptsNull: true, choices: ['camel case', 'snake case'],
  conflictsWith: [], value: 'camel case',
};
const limit: LintRule = {id: 'max-line-length', type: 'integer', acceptsNull: true, choices: [], conflictsWith: [], value: 80};
const rules = [identifier, limit];

describe('lint draft', () => {
  it('reuses the formatting draft helpers for lint rules', () => {
    const draft = draftOf(rules);

    expect(draft).toEqual({identifier_format: 'camel case', 'max-line-length': 80});
    expect(isDirty(draft, rules)).toBe(false);
    expect(isDirty(withValue(draft, 'identifier_format', 'snake case'), rules)).toBe(true);
  });

  it('only blocks numbers that are not whole, and leaves ranges to the server', () => {
    expect(invalidLintInputs(draftOf(rules), rules)).toEqual([]);
    expect(invalidLintInputs({...draftOf(rules), 'max-line-length': 100000}, rules)).toEqual([]);
    expect(invalidLintInputs({...draftOf(rules), 'max-line-length': null}, rules)).toEqual([]);
    expect(invalidLintInputs({...draftOf(rules), 'max-line-length': Number.NaN}, rules)).toEqual(['max-line-length']);
    expect(invalidLintInputs({...draftOf(rules), 'max-line-length': 2.5}, rules)).toEqual(['max-line-length']);
  });
});

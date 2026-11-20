import {describe, expect, it} from 'vitest';
import {fromFormattingRulesDto, toFormattingRulesBody} from './formattingRules';

const revision = 'sha256-v1:' + 'a'.repeat(64);
const jobId = '990e8400-e29b-41d4-a716-446655440000';
const spacing = {
  id: 'enforce-spacing-around-equals', type: 'boolean', default: false, minimum: null, maximum: null,
  conflictsWith: ['enforce-no-spacing-around-equals'], description: 'Un espacio alrededor de cada =.', value: true,
};
const indent = {
  id: 'indent-inside-if', type: 'integer', default: null, minimum: 0, maximum: 10,
  conflictsWith: [], description: 'Espacios de sangría dentro de un if.', value: null,
};
const dto = {language: 'printscript', version: '1.1', revision, changed: true, jobId, rules: [spacing, indent]};

describe('formatting rules contract', () => {
  it('keeps the real catalog with every current value and the job to follow', () => {
    expect(fromFormattingRulesDto(dto, 'printscript', '1.1')).toEqual({
      language: 'printscript', version: '1.1', revision, changed: true, jobId, rules: [spacing, indent],
    });
  });

  it('accepts a read without a job', () => {
    expect(fromFormattingRulesDto({...dto, changed: false, jobId: null}, 'printscript', '1.1').jobId).toBeNull();
  });

  it.each([
    ['another scope', {...dto, version: '1.0'}],
    ['a malformed revision', {...dto, revision: 'v1'}],
    ['a job that is not a UUID', {...dto, jobId: 'job-1'}],
    ['an unknown rule type', {...dto, rules: [{...spacing, type: 'choice'}]}],
    ['a boolean with a number value', {...dto, rules: [{...spacing, value: 1}]}],
    ['an integer with a text value', {...dto, rules: [{...indent, value: '2'}]}],
    ['a decimal integer value', {...dto, rules: [{...indent, value: 2.5}]}],
    ['repeated rules', {...dto, rules: [spacing, spacing]}],
    ['a missing description', {...dto, rules: [{...spacing, description: undefined}]}],
  ])('rejects %s instead of showing invented rules', (_, value) => {
    expect(() => fromFormattingRulesDto(value, 'printscript', '1.1')).toThrow('Unexpected API response');
  });

  it('sends the whole selection, keeping off values as the provider expects them', () => {
    const draft = {'enforce-spacing-around-equals': false, 'indent-inside-if': null, 'if-brace-below-line': true};

    expect(toFormattingRulesBody(draft)).toEqual({rules: draft});
    expect(toFormattingRulesBody(draft).rules).not.toBe(draft);
  });
});

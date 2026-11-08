import {describe, expect, it} from 'vitest';
import {fromLintingRulesDto, toLintingRulesBody} from './lintingRules';

const revision = 'sha256-v1:' + 'a'.repeat(64);
const jobId = '990e8400-e29b-41d4-a716-446655440000';
const println = {
  id: 'mandatory-variable-or-literal-in-println', type: 'boolean', acceptsNull: true, choices: [],
  conflictsWith: [], value: true,
};
const identifier = {
  id: 'identifier_format', type: 'choice', acceptsNull: true, choices: ['camel case', 'snake case'],
  conflictsWith: [], value: 'camel case',
};
const limit = {id: 'max-line-length', type: 'integer', acceptsNull: true, choices: [], conflictsWith: [], value: null};
const dto = {language: 'printscript', version: '1.1', revision, changed: true, jobId, rules: [println, identifier, limit]};

describe('linting rules contract', () => {
  it('keeps the real catalog with the type, options and current value of every rule', () => {
    expect(fromLintingRulesDto(dto, 'printscript', '1.1')).toEqual(dto);
  });

  it('accepts a read without a job and rules without a value', () => {
    const read = fromLintingRulesDto({...dto, changed: false, jobId: null}, 'printscript', '1.1');

    expect(read.jobId).toBeNull();
    expect(read.rules[2].value).toBeNull();
  });

  it.each([
    ['another scope', {...dto, language: 'python'}],
    ['a malformed revision', {...dto, revision: 'r1'}],
    ['a job that is not a UUID', {...dto, jobId: 'job-1'}],
    ['an unknown rule type', {...dto, rules: [{...println, type: 'text'}]}],
    ['a boolean with a text value', {...dto, rules: [{...println, value: 'true'}]}],
    ['a choice outside its options', {...dto, rules: [{...identifier, value: 'kebab case'}]}],
    ['a choice without options', {...dto, rules: [{...identifier, choices: []}]}],
    ['a decimal integer', {...dto, rules: [{...limit, value: 1.5}]}],
    ['null on a rule that does not accept it', {...dto, rules: [{...println, acceptsNull: false, value: null}]}],
    ['repeated rules', {...dto, rules: [println, println]}],
    ['conflicts that are not text', {...dto, rules: [{...println, conflictsWith: [1]}]}],
    ['no object', 'rules'],
  ])('rejects %s', (_, value) => {
    expect(() => fromLintingRulesDto(value, 'printscript', '1.1')).toThrow();
  });

  it('sends the whole selection, including an empty one that turns every rule off', () => {
    expect(toLintingRulesBody({identifier_format: 'snake case', 'max-line-length': null}))
      .toEqual({rules: {identifier_format: 'snake case', 'max-line-length': null}});
    expect(toLintingRulesBody({})).toEqual({rules: {}});
  });
});

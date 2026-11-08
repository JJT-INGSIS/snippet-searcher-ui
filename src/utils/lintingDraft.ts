import {LintRule, LintRuleValue} from './api/lintingRules';

export type LintingDraft = Record<string, LintRuleValue>;

export function invalidLintInputs(draft: LintingDraft, rules: LintRule[]): string[] {
  return rules
    .filter(rule => rule.type === 'integer' && draft[rule.id] !== null && !Number.isInteger(draft[rule.id]))
    .map(rule => rule.id);
}

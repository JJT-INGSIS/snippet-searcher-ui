import {FormattingRule, RuleValue} from './api/formattingRules';
import {RuleViolation} from './api/errors';

export type FormattingDraft = Record<string, RuleValue>;

const reasons: Record<string, string> = {
  'unknown-rule': 'Esta regla no existe en el catálogo.',
  'unavailable-in-version': 'Esta regla no está disponible en esta versión.',
  'wrong-type': 'El valor no tiene el tipo esperado.',
  'out-of-range': 'El valor está fuera del rango permitido.',
  'conflicting-rules': 'No se puede combinar con otra regla prendida.',
};

export function draftOf(rules: FormattingRule[]): FormattingDraft {
  return Object.fromEntries(rules.map(rule => [rule.id, rule.value]));
}

export function isDirty(draft: FormattingDraft, rules: FormattingRule[]): boolean {
  return rules.some(rule => draft[rule.id] !== rule.value);
}

export function withValue(draft: FormattingDraft, id: string, value: RuleValue): FormattingDraft {
  return {...draft, [id]: value};
}

export function outOfBounds(rule: FormattingRule, value: RuleValue): boolean {
  if (rule.type !== 'integer' || value === null) return false;
  const tooLow = rule.minimum !== null && Number(value) < rule.minimum;
  const tooHigh = rule.maximum !== null && Number(value) > rule.maximum;
  return !Number.isInteger(value) || tooLow || tooHigh;
}

export function invalidInputs(draft: FormattingDraft, rules: FormattingRule[]): string[] {
  return rules.filter(rule => outOfBounds(rule, draft[rule.id])).map(rule => rule.id);
}

export function violationMessages(violations: RuleViolation[]): Record<string, string[]> {
  return violations.reduce<Record<string, string[]>>((byRule, violation) => ({
    ...byRule,
    [violation.rule]: [...(byRule[violation.rule] ?? []), reasons[violation.reason] ?? 'El proveedor rechazó este valor.'],
  }), {});
}

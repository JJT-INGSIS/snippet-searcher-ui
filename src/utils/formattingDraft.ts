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

type SavedRule<V> = {id: string; value: V};

export function draftOf<V>(rules: SavedRule<V>[]): Record<string, V> {
  return Object.fromEntries(rules.map(rule => [rule.id, rule.value]));
}

export function isDirty<V>(draft: Record<string, V>, rules: SavedRule<V>[]): boolean {
  return rules.some(rule => draft[rule.id] !== rule.value);
}

export function withValue<V>(draft: Record<string, V>, id: string, value: V): Record<string, V> {
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

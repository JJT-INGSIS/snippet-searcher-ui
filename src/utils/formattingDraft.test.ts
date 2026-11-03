import {describe, expect, it} from 'vitest';
import {draftOf, invalidInputs, isDirty, outOfBounds, violationMessages, withValue} from './formattingDraft';
import {FormattingRule} from './api/formattingRules';

const spacing: FormattingRule = {
  id: 'enforce-spacing-around-equals', type: 'boolean', default: false, minimum: null, maximum: null,
  conflictsWith: [], description: 'Un espacio alrededor de cada =.', value: false,
};
const indent: FormattingRule = {
  id: 'indent-inside-if', type: 'integer', default: null, minimum: 0, maximum: 10,
  conflictsWith: [], description: 'Sangría dentro de un if.', value: 2,
};
const rules = [spacing, indent];

describe('formatting draft', () => {
  it('starts from the saved values and is clean until something changes', () => {
    const draft = draftOf(rules);

    expect(draft).toEqual({'enforce-spacing-around-equals': false, 'indent-inside-if': 2});
    expect(isDirty(draft, rules)).toBe(false);
    expect(isDirty(withValue(draft, 'indent-inside-if', 4), rules)).toBe(true);
    expect(isDirty(withValue(withValue(draft, 'indent-inside-if', 4), 'indent-inside-if', 2), rules)).toBe(false);
  });

  it('never changes the previous draft', () => {
    const draft = draftOf(rules);

    withValue(draft, 'enforce-spacing-around-equals', true);

    expect(draft['enforce-spacing-around-equals']).toBe(false);
  });

  it('only flags integers outside the bounds published by the catalog', () => {
    expect(outOfBounds(indent, 0)).toBe(false);
    expect(outOfBounds(indent, 10)).toBe(false);
    expect(outOfBounds(indent, null)).toBe(false);
    expect(outOfBounds(indent, 11)).toBe(true);
    expect(outOfBounds(indent, -1)).toBe(true);
    expect(outOfBounds(indent, 2.5)).toBe(true);
    expect(outOfBounds(spacing, true)).toBe(false);
    expect(invalidInputs(withValue(draftOf(rules), 'indent-inside-if', 11), rules)).toEqual(['indent-inside-if']);
  });

  it('turns every provider violation into a message next to its rule', () => {
    const messages = violationMessages([
      {rule: 'indent-inside-if', reason: 'out-of-range'},
      {rule: 'enforce-spacing-around-equals', reason: 'conflicting-rules'},
      {rule: 'indent-inside-if', reason: 'something-new'},
    ]);

    expect(messages).toEqual({
      'indent-inside-if': ['El valor está fuera del rango permitido.', 'El proveedor rechazó este valor.'],
      'enforce-spacing-around-equals': ['No se puede combinar con otra regla prendida.'],
    });
  });
});

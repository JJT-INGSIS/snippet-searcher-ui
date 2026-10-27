import {describe, expect, it} from 'vitest';
import {fromTestDefinition, fromTestDefinitions, toTestDefinitionDraft} from './testDefinitions';

const snippetId = '770e8400-e29b-41d4-a716-446655440000';
const dto = {id: '880e8400-e29b-41d4-a716-446655440000', snippetId, inputs: ['', 'ñ', 'ñ'], expectedOutputs: [' a ', '', 'a\nb']};

describe('test definitions: exact ordered data', () => {
  it('preserves empty strings, duplicate values, order, whitespace and Unicode', () => {
    expect(fromTestDefinition(dto, snippetId)).toEqual(dto);
    expect(fromTestDefinitions({items: [dto]}, snippetId)).toEqual([dto]);
    expect(fromTestDefinitions({items: []}, snippetId)).toEqual([]);
  });
  it('returns independent arrays and omits non-contract request fields', () => {
    const draft = {...dto, ownerId: 'not-authoritative'};
    const mapped = toTestDefinitionDraft(draft);
    expect(mapped).toEqual({inputs: dto.inputs, expectedOutputs: dto.expectedOutputs});
    expect(mapped.inputs).not.toBe(dto.inputs);
    expect(fromTestDefinition(dto, snippetId).expectedOutputs).not.toBe(dto.expectedOutputs);
  });
  it.each([
    null, {}, {...dto, id: 'bad'}, {...dto, id: dto.id.toUpperCase()},
    {...dto, snippetId: 'other'}, {...dto, inputs: null}, {...dto, inputs: [null]},
    {...dto, expectedOutputs: 'not-an-array'}, {...dto, expectedOutputs: [1]},
  ])('rejects incompatible responses: %j', value => {
    expect(() => fromTestDefinition(value, snippetId)).toThrow();
  });
  it('rejects an incompatible list instead of converting it to empty', () => {
    for (const value of [[], {}, {items: null}, {items: [dto, dto]}, {items: [dto, {...dto, snippetId: 'other'}]}]) {
      expect(() => fromTestDefinitions(value, snippetId)).toThrow();
    }
  });
});

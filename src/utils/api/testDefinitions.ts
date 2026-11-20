import {TestDefinition, TestDefinitionDraft} from '../../types/TestDefinition';
import {invalidResponse} from './dto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

export function fromTestDefinition(value: unknown, snippetId: string): TestDefinition {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (typeof dto.id !== 'string' || !uuid.test(dto.id) || dto.snippetId !== snippetId ||
      !uuid.test(snippetId) || !strings(dto.inputs) || !strings(dto.expectedOutputs)) throw invalidResponse();
  return {id: dto.id, snippetId, inputs: [...dto.inputs], expectedOutputs: [...dto.expectedOutputs]};
}

export function fromTestDefinitions(value: unknown, snippetId: string): TestDefinition[] {
  if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items)) throw invalidResponse();
  const items = value.items.map(item => fromTestDefinition(item, snippetId));
  if (new Set(items.map(item => item.id)).size !== items.length) throw invalidResponse();
  return items;
}

export function toTestDefinitionDraft(input: TestDefinitionDraft): TestDefinitionDraft {
  // Explicit mapping excludes owner, IDs, names and execution results, without trimming strings.
  if (!strings(input.inputs) || !strings(input.expectedOutputs)) throw invalidResponse();
  return {inputs: [...input.inputs], expectedOutputs: [...input.expectedOutputs]};
}

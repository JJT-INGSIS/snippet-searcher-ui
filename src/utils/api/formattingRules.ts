import {invalidResponse} from './dto';

export type RuleValue = boolean | number | null;
export type FormattingRuleType = 'boolean' | 'integer';
export type FormattingRule = {
  id: string; type: FormattingRuleType; default: RuleValue; minimum: number | null; maximum: number | null;
  conflictsWith: string[]; description: string; value: RuleValue;
};
export type FormattingRules = {
  language: string; version: string; revision: string; changed: boolean; jobId: string | null; rules: FormattingRule[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const revision = /^sha256-v1:[0-9a-f]{64}$/;
const integerOrNull = (value: unknown): value is number | null => value === null || Number.isInteger(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');

function ruleValue(type: FormattingRuleType, value: unknown): value is RuleValue {
  return type === 'boolean' ? typeof value === 'boolean' : integerOrNull(value);
}

function fromRuleDto(value: unknown): FormattingRule {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (typeof dto.id !== 'string' || !dto.id || (dto.type !== 'boolean' && dto.type !== 'integer') ||
      !integerOrNull(dto.minimum) || !integerOrNull(dto.maximum) || !strings(dto.conflictsWith) ||
      typeof dto.description !== 'string' || !ruleValue(dto.type, dto.default) || !ruleValue(dto.type, dto.value)) {
    throw invalidResponse();
  }
  return {
    id: dto.id, type: dto.type, default: dto.default, minimum: dto.minimum, maximum: dto.maximum,
    conflictsWith: [...dto.conflictsWith], description: dto.description, value: dto.value,
  };
}

export function fromFormattingRulesDto(value: unknown, language: string, version: string): FormattingRules {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (dto.language !== language || dto.version !== version || typeof dto.revision !== 'string' ||
      !revision.test(dto.revision) || typeof dto.changed !== 'boolean' || !Array.isArray(dto.rules) ||
      !(dto.jobId === null || (typeof dto.jobId === 'string' && uuid.test(dto.jobId)))) throw invalidResponse();
  const rules = dto.rules.map(fromRuleDto);
  if (new Set(rules.map(rule => rule.id)).size !== rules.length) throw invalidResponse();
  return {language, version, revision: dto.revision, changed: dto.changed, jobId: dto.jobId, rules};
}

export function toFormattingRulesBody(draft: Record<string, RuleValue>): {rules: Record<string, RuleValue>} {
  return {rules: {...draft}};
}

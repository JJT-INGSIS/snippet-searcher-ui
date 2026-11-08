import {invalidResponse} from './dto';
import {isJobId, isRevision, isTextList} from './contractFormats';

export type LintRuleType = 'boolean' | 'integer' | 'choice';
export type LintRuleValue = boolean | number | string | null;
export type LintRule = {
  id: string; type: LintRuleType; acceptsNull: boolean; choices: string[]; conflictsWith: string[]; value: LintRuleValue;
};
export type LintingRules = {
  language: string; version: string; revision: string; changed: boolean; jobId: string | null; rules: LintRule[];
};

const types: LintRuleType[] = ['boolean', 'integer', 'choice'];

function fitsType(type: LintRuleType, choices: string[], value: unknown): boolean {
  switch (type) {
  case 'boolean':
    return typeof value === 'boolean';
  case 'integer':
    return Number.isInteger(value);
  default:
    return typeof value === 'string' && choices.includes(value);
  }
}

function fromLintRuleDto(value: unknown): LintRule {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (typeof dto.id !== 'string' || !dto.id || !types.includes(dto.type as LintRuleType) ||
      typeof dto.acceptsNull !== 'boolean' || !isTextList(dto.choices) || !isTextList(dto.conflictsWith)) {
    throw invalidResponse();
  }
  const type = dto.type as LintRuleType;
  const allowed = dto.value === null ? dto.acceptsNull : fitsType(type, dto.choices, dto.value);
  if (!allowed || (type === 'choice' && dto.choices.length === 0)) throw invalidResponse();
  return {
    id: dto.id, type, acceptsNull: dto.acceptsNull, choices: [...dto.choices],
    conflictsWith: [...dto.conflictsWith], value: dto.value as LintRuleValue,
  };
}

export function fromLintingRulesDto(value: unknown, language: string, version: string): LintingRules {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (dto.language !== language || dto.version !== version || !isRevision(dto.revision) ||
      typeof dto.changed !== 'boolean' || !Array.isArray(dto.rules) || !(dto.jobId === null || isJobId(dto.jobId))) {
    throw invalidResponse();
  }
  const rules = dto.rules.map(fromLintRuleDto);
  if (new Set(rules.map(rule => rule.id)).size !== rules.length) throw invalidResponse();
  return {language, version, revision: dto.revision, changed: dto.changed, jobId: dto.jobId, rules};
}

export function toLintingRulesBody(draft: Record<string, LintRuleValue>): {rules: Record<string, LintRuleValue>} {
  return {rules: {...draft}};
}

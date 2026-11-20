import {invalidResponse} from './dto';
import {Diagnostic} from './errors';
import {isRevision} from './contractFormats';

export type LintStatus = 'compliant' | 'not-compliant' | 'pending' | 'failed';
export type LintResult = {
  status: LintStatus; reason: string | null; diagnostics: Diagnostic[];
  codeHash: string | null; rulesRevision: string | null; processorRevision: string | null;
};

const statuses: LintStatus[] = ['compliant', 'not-compliant', 'pending', 'failed'];
const FIRST_POSITION = 1;
const position = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= FIRST_POSITION;
const textOrNull = (value: unknown): value is string | null => value === null || (typeof value === 'string' && value.length > 0);
const revisionOrNull = (value: unknown): value is string | null => value === null || isRevision(value);

function fromDiagnosticDto(value: unknown): Diagnostic {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (typeof dto.rule !== 'string' || typeof dto.message !== 'string' || !position(dto.line) || !position(dto.column)) {
    throw invalidResponse();
  }
  return {rule: dto.rule, message: dto.message, line: dto.line, column: dto.column};
}

export function fromLintDto(value: unknown): LintResult {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (!statuses.includes(dto.status as LintStatus) || !textOrNull(dto.reason) || !Array.isArray(dto.diagnostics) ||
      !textOrNull(dto.codeHash) || !revisionOrNull(dto.rulesRevision) || !revisionOrNull(dto.processorRevision)) {
    throw invalidResponse();
  }
  const status = dto.status as LintStatus;
  const diagnostics = dto.diagnostics.map(fromDiagnosticDto);
  const evaluated = status === 'compliant' || status === 'not-compliant';
  const withoutDiagnostics = status === 'compliant' || status === 'pending';
  if ((evaluated && dto.processorRevision === null) || (withoutDiagnostics && diagnostics.length > 0)) throw invalidResponse();
  return {
    status, reason: dto.reason, diagnostics, codeHash: dto.codeHash,
    rulesRevision: dto.rulesRevision, processorRevision: dto.processorRevision,
  };
}

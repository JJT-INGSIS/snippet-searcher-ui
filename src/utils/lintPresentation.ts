import {Diagnostic} from './api/errors';
import {LintResult, LintStatus} from './api/lintResult';

const labels: Record<LintStatus, string> = {
  compliant: 'Sin infracciones', 'not-compliant': 'Con infracciones', pending: 'Pendiente', failed: 'No se pudo evaluar',
};
const pendingLabels: Record<string, string> = {NOT_EVALUATED: 'Sin evaluar', SUPERSEDED: 'Desactualizado'};
const pendingExplanations: Record<string, string> = {
  NOT_EVALUATED: 'Este snippet todavía no se evaluó con las reglas de lint vigentes.',
  SUPERSEDED: 'El resultado anterior quedó desactualizado y se está reevaluando.',
};
const failureExplanations: Record<string, string> = {
  CODE_NOT_ANALYZABLE: 'El código tiene errores que impiden analizarlo.',
  RULES_NO_LONGER_VALID: 'Las reglas de lint guardadas ya no son válidas para esta versión.',
  CODE_TOO_LARGE: 'El código o el resultado superan el tamaño permitido.',
  DIAGNOSTICS_TOO_LARGE: 'El código o el resultado superan el tamaño permitido.',
  UNSUPPORTED_LANGUAGE: 'Este lenguaje o esta versión no tienen lint.',
  UNSUPPORTED_VERSION: 'Este lenguaje o esta versión no tienen lint.',
};
const severities: Record<LintStatus, 'success' | 'warning' | 'info' | 'error'> = {
  compliant: 'success', 'not-compliant': 'warning', pending: 'info', failed: 'error',
};
const technicalFailure = 'No se pudo evaluar por un problema técnico. Se vuelve a evaluar al guardar el snippet o con el próximo cambio de reglas.';

export const lintFilterOptions: {status: LintStatus; label: string}[] = [
  {status: 'compliant', label: labels.compliant},
  {status: 'not-compliant', label: labels['not-compliant']},
  {status: 'pending', label: labels.pending},
  {status: 'failed', label: labels.failed},
];

export function lintLabel(lint: LintResult): string {
  if (lint.status === 'pending' && lint.reason) return pendingLabels[lint.reason] ?? labels.pending;
  return labels[lint.status];
}

export function lintExplanation(lint: LintResult): string | null {
  if (lint.status === 'pending') return pendingExplanations[lint.reason ?? ''] ?? pendingExplanations.NOT_EVALUATED;
  if (lint.status === 'failed') return failureExplanations[lint.reason ?? ''] ?? technicalFailure;
  return null;
}

export function lintSeverity(lint: LintResult): 'success' | 'warning' | 'info' | 'error' {
  return severities[lint.status];
}

export function diagnosticText(diagnostic: Diagnostic): string {
  return diagnostic.rule + ': ' + diagnostic.message + ' (' + diagnostic.line + ':' + diagnostic.column + ')';
}

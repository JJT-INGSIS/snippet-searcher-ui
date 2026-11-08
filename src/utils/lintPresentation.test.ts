import {describe, expect, it} from 'vitest';
import {diagnosticText, lintExplanation, lintLabel} from './lintPresentation';
import {LintResult} from './api/lintResult';

const result = (status: LintResult['status'], reason: string | null = null): LintResult =>
  ({status, reason, diagnostics: [], codeHash: null, rulesRevision: null, processorRevision: null});

describe('lint presentation', () => {
  it('labels every state without confusing a failure with a violation', () => {
    expect(lintLabel(result('compliant'))).toBe('Sin infracciones');
    expect(lintLabel(result('not-compliant'))).toBe('Con infracciones');
    expect(lintLabel(result('pending', 'NOT_EVALUATED'))).toBe('Sin evaluar');
    expect(lintLabel(result('pending', 'SUPERSEDED'))).toBe('Desactualizado');
    expect(lintLabel(result('pending', null))).toBe('Pendiente');
    expect(lintLabel(result('failed', 'LINT_UNAVAILABLE'))).toBe('No se pudo evaluar');
  });

  it('explains why a result is not available', () => {
    expect(lintExplanation(result('pending', 'SUPERSEDED'))).toContain('reevaluando');
    expect(lintExplanation(result('pending', 'NOT_EVALUATED'))).toContain('todavía no se evaluó');
    expect(lintExplanation(result('failed', 'CODE_NOT_ANALYZABLE'))).toContain('errores que impiden analizarlo');
    expect(lintExplanation(result('failed', 'RULES_NO_LONGER_VALID'))).toContain('reglas');
    expect(lintExplanation(result('failed', 'DIAGNOSTICS_TOO_LARGE'))).toContain('tamaño');
    expect(lintExplanation(result('failed', 'UNSUPPORTED_VERSION'))).toContain('no tienen lint');
    expect(lintExplanation(result('failed', 'PROCESSOR_UNVERIFIABLE'))).toContain('problema técnico');
    expect(lintExplanation(result('failed', 'SOMETHING_NEW'))).toContain('problema técnico');
    expect(lintExplanation(result('compliant'))).toBeNull();
    expect(lintExplanation(result('not-compliant'))).toBeNull();
  });

  it('writes each diagnostic with its rule and position', () => {
    expect(diagnosticText({rule: 'identifier_format', message: 'Usá camel case', line: 3, column: 7}))
      .toBe('identifier_format: Usá camel case (3:7)');
  });
});

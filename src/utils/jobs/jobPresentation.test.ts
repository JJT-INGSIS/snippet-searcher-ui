import {describe, expect, it} from 'vitest';
import {describeJob} from './jobPresentation';
import {JobProgress} from './jobProgress';

const progress = (status: JobProgress['status'], processed = 3, failed = 0, pending = 0, selectionComplete = true) =>
  ({id: 'job', status, processed, failed, pending, selectionComplete});

describe('job presentation', () => {
  it('tells pending work apart from a finished one', () => {
    expect(describeJob(progress('RUNNING', 1, 0, 2))).toEqual({
      severity: 'info', title: 'Reformateando tus snippets', detail: 'Listos: 1 snippet; pendientes: 2 snippets.',
    });
    expect(describeJob(progress('PENDING', 0, 0, 0, false)).detail).toContain('todavía buscando snippets');
    expect(describeJob(progress('COMPLETED'))).toEqual({severity: 'success', title: 'Listo', detail: 'Reformateados: 3 snippets.'});
  });

  it('reports partial failures, failures and superseded batches without hiding the saved rules', () => {
    expect(describeJob(progress('PARTIAL', 2, 1))).toEqual({
      severity: 'warning', title: 'Terminó con fallos', detail: 'Reformateados: 2 snippets; sin poder formatear: 1 snippet.',
    });
    expect(describeJob(progress('FAILED')).detail).toContain('Tus reglas siguen guardadas');
    expect(describeJob(progress('SUPERSEDED')).severity).toBe('info');
  });
});

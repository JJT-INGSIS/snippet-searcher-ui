import {JobProgress} from './jobProgress';

export type JobSummary = {severity: 'info' | 'success' | 'warning' | 'error'; title: string; detail: string};

export type JobKind = 'format' | 'lint';

type JobWords = {running: string; done: string; skipped: string};

const words: Record<JobKind, JobWords> = {
  format: {running: 'Reformateando tus snippets', done: 'Reformateados', skipped: 'sin poder formatear'},
  lint: {running: 'Evaluando lint de tus snippets', done: 'Evaluados', skipped: 'sin poder evaluar'},
};

const snippets = (count: number) => count === 1 ? '1 snippet' : count + ' snippets';

export function describeJob(progress: JobProgress, kind: JobKind = 'format'): JobSummary {
  const {running, done, skipped} = words[kind];
  switch (progress.status) {
  case 'COMPLETED':
    return {severity: 'success', title: 'Listo', detail: done + ': ' + snippets(progress.processed) + '.'};
  case 'PARTIAL':
    return {severity: 'warning', title: 'Terminó con fallos',
      detail: done + ': ' + snippets(progress.processed) + '; ' + skipped + ': ' + snippets(progress.failed) + '.'};
  case 'FAILED':
    return {severity: 'error', title: 'No se pudo completar', detail: 'El reprocesamiento no terminó. Tus reglas siguen guardadas.'};
  case 'SUPERSEDED':
    return {severity: 'info', title: 'Reemplazado', detail: 'Un cambio de reglas más nuevo continúa el reprocesamiento.'};
  default:
    return {severity: 'info', title: running,
      detail: 'Listos: ' + snippets(progress.processed) + '; pendientes: ' + snippets(progress.pending) +
        (progress.selectionComplete ? '.' : '; todavía buscando snippets.')};
  }
}

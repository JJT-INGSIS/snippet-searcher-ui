import {JobProgress} from './jobProgress';

export type JobSummary = {severity: 'info' | 'success' | 'warning' | 'error'; title: string; detail: string};

const snippets = (count: number) => count === 1 ? '1 snippet' : count + ' snippets';

export function describeJob(progress: JobProgress): JobSummary {
  switch (progress.status) {
  case 'COMPLETED':
    return {severity: 'success', title: 'Listo', detail: 'Reformateados: ' + snippets(progress.processed) + '.'};
  case 'PARTIAL':
    return {severity: 'warning', title: 'Terminó con fallos',
      detail: 'Reformateados: ' + snippets(progress.processed) + '; sin poder formatear: ' + snippets(progress.failed) + '.'};
  case 'FAILED':
    return {severity: 'error', title: 'No se pudo completar', detail: 'El reprocesamiento no terminó. Tus reglas siguen guardadas.'};
  case 'SUPERSEDED':
    return {severity: 'info', title: 'Reemplazado', detail: 'Un cambio de reglas más nuevo continúa el reprocesamiento.'};
  default:
    return {severity: 'info', title: 'Reformateando tus snippets',
      detail: 'Listos: ' + snippets(progress.processed) + '; pendientes: ' + snippets(progress.pending) +
        (progress.selectionComplete ? '.' : '; todavía buscando snippets.')};
  }
}

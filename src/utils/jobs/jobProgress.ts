import {invalidResponse} from '../api/dto';

export type JobStatus = 'PENDING' | 'RUNNING' | 'RETRY' | 'UNKNOWN' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'SUPERSEDED';
export type JobProgress = {
  id: string; status: JobStatus; processed: number; failed: number; pending: number; selectionComplete: boolean;
};

const statuses: JobStatus[] = ['PENDING', 'RUNNING', 'RETRY', 'UNKNOWN', 'COMPLETED', 'PARTIAL', 'FAILED', 'SUPERSEDED'];
const terminal: JobStatus[] = ['COMPLETED', 'PARTIAL', 'FAILED', 'SUPERSEDED'];
const count = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

export const jobKeys = {
  progress: (actor: string, jobId: string) => ['jobs', actor, jobId],
};

export const isFinished = (progress: JobProgress) => terminal.includes(progress.status);

export function fromJobProgressDto(value: unknown, jobId: string): JobProgress {
  if (!value || typeof value !== 'object') throw invalidResponse();
  const dto = value as Record<string, unknown>;
  if (dto.id !== jobId || !statuses.includes(dto.status as JobStatus) || !count(dto.processed) ||
      !count(dto.failed) || !count(dto.pending) || typeof dto.selectionComplete !== 'boolean') throw invalidResponse();
  return {
    id: jobId, status: dto.status as JobStatus, processed: dto.processed, failed: dto.failed,
    pending: dto.pending, selectionComplete: dto.selectionComplete,
  };
}

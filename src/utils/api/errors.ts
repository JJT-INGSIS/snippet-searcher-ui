import axios from 'axios';
export type Diagnostic = {rule: string; message: string; line: number; column: number};
export type ApiProblem = {type: string; status: number; detail?: string; field?: string; parameter?: string; diagnostics?: Diagnostic[]};
export class ApiError extends Error {
  constructor(message: string, readonly problem?: ApiProblem, readonly uncertain = false) {
    super(message);
    this.name = 'ApiError';
  }
}
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!axios.isAxiosError(error)) return new ApiError('Unexpected client error.');
  if (!error.response) return new ApiError('No server confirmation. Check the connection and retry the same request.', undefined, true);
  const {status, data} = error.response;
  const body = data && typeof data === 'object' ? data : {};
  const problem: ApiProblem = {
    type: typeof body.type === 'string' ? body.type : 'about:blank', status,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
    field: typeof body.field === 'string' ? body.field : undefined,
    parameter: typeof body.parameter === 'string' ? body.parameter : undefined,
    diagnostics: Array.isArray(body.diagnostics) ? body.diagnostics.filter((d: Diagnostic) =>
      d && typeof d.rule === 'string' && typeof d.message === 'string' && typeof d.line === 'number' && typeof d.column === 'number') : undefined,
  };
  const category = problem.type.replace('urn:snippets:problem:', '');
  return new ApiError(category + ' (HTTP ' + status + ')' + (problem.detail ? ': ' + problem.detail : ''), problem,
    status >= 500 || category === 'snippet-pending');
}
export const unsupported = () => Promise.reject(new ApiError('This operation is not available yet.'));

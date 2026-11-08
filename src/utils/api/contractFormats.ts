const revisionFormat = /^sha256-v1:[0-9a-f]{64}$/;
const jobIdFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isRevision = (value: unknown): value is string => typeof value === 'string' && revisionFormat.test(value);
export const isJobId = (value: unknown): value is string => typeof value === 'string' && jobIdFormat.test(value);
export const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

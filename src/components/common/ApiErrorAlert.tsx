import {Alert, Typography} from '@mui/material';
import {ApiError} from '../../utils/api/errors';
export function ApiErrorAlert({error}: {error: Error | null | undefined}) {
  if (!error) return null;
  return <Alert severity="error">
    {error.message}
    {error instanceof ApiError && <>
      {error.problem?.field && <Typography>Field: {error.problem.field}</Typography>}
      {error.problem?.parameter && <Typography>Parameter: {error.problem.parameter}</Typography>}
      {error.problem?.diagnostics?.map((d, i) => <Typography key={i}>{d.rule}: {d.message} ({d.line}:{d.column})</Typography>)}
      {error.uncertain && <Typography>The result is uncertain. Retry the same request before starting another creation.</Typography>}
    </>}
  </Alert>;
}

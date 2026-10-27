import {Alert, Stack, Typography} from '@mui/material';
import {ApiError} from '../../utils/api/errors';
import {errorMessage} from '../../utils/presentation';
import {useEffect, useRef} from 'react';

export function ApiErrorAlert({error, creation = false, focusOnError = false}: {error: Error | null | undefined; creation?: boolean; focusOnError?: boolean}) {
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => {if (error && focusOnError) alert.current?.focus();}, [error, focusOnError]);
  if (!error) return null;
  return <Alert ref={alert} tabIndex={-1} severity="error"><Stack spacing={.5}>
    <Typography>{errorMessage(error)}</Typography>
    {error instanceof ApiError && <>
      {error.problem?.field && <Typography variant="body2">Campo: {error.problem.field}</Typography>}
      {error.problem?.parameter && <Typography variant="body2">Parámetro: {error.problem.parameter}</Typography>}
      {error.problem?.diagnostics?.map((diagnostic, index) => <Typography key={index} variant="body2">
        {diagnostic.rule}: {diagnostic.message} ({diagnostic.line}:{diagnostic.column})
      </Typography>)}
      {creation && error.uncertain && <Typography variant="body2">Reintentá esta misma creación para evitar duplicados.</Typography>}
    </>}
  </Stack></Alert>;
}

import {Alert, AlertTitle, Button, LinearProgress, Stack, Typography} from '@mui/material';
import {TrackedJob, useJobProgress} from '../../utils/jobs/useJobProgress';
import {JobProgress, isFinished} from '../../utils/jobs/jobProgress';
import {describeJob} from '../../utils/jobs/jobPresentation';

const FULL_PERCENT = 100;
const DETAIL_SPACING = 1;

const percent = (progress: JobProgress) => {
  const total = progress.processed + progress.failed + progress.pending;
  return total === 0 ? 0 : Math.round(FULL_PERCENT * (progress.processed + progress.failed) / total);
};

export function JobProgressPanel({job}: {job: TrackedJob | undefined}) {
  const {progress, error, expired, refresh} = useJobProgress(job);
  const refreshButton = <Button color="inherit" size="small" onClick={() => void refresh()}>Actualizar progreso</Button>;
  if (!job) return null;
  if (error) return <Alert severity="warning" action={refreshButton}>
    No pudimos consultar el progreso. Tus reglas ya quedaron guardadas.
  </Alert>;
  if (!progress) return <Alert severity="info">Consultando el progreso del reformateo…</Alert>;
  const summary = describeJob(progress);
  const running = !isFinished(progress);
  return <Alert severity={summary.severity} role="status" action={expired ? refreshButton : undefined}>
    <AlertTitle>{summary.title}</AlertTitle>
    <Stack spacing={DETAIL_SPACING}>
      <Typography variant="body2">{summary.detail}</Typography>
      {running && <LinearProgress aria-label="Progreso del reformateo"
        variant={progress.selectionComplete ? 'determinate' : 'indeterminate'} value={percent(progress)}/>}
      {expired && <Typography variant="body2">Dejamos de consultar solos. Podés actualizar el progreso cuando quieras.</Typography>}
    </Stack>
  </Alert>;
}

import {Button, CircularProgress} from '@mui/material';
import {DownloadRounded} from '@mui/icons-material';

const LOADER_SIZE = 18;

type Props = {preparing: boolean; onDownload: () => void};

export function FormattedDownloadButton({preparing, onDownload}: Props) {
  return <Button data-testid="download-formatted" disabled={preparing} onClick={onDownload}
    startIcon={preparing ? <CircularProgress size={LOADER_SIZE} color="inherit"/> : <DownloadRounded/>}>
    {preparing ? 'Preparando…' : 'Descargar formateado'}
  </Button>;
}

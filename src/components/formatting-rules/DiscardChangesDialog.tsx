import {Button, Typography} from '@mui/material';
import {ModalWrapper} from '../common/ModalWrapper';

type Props = {open: boolean; onKeep: () => void; onDiscard: () => void};

export function DiscardChangesDialog({open, onKeep, onDiscard}: Props) {
  return <ModalWrapper open={open} onClose={onKeep} title="Cambios sin guardar" actions={<>
    <Button onClick={onKeep}>Seguir editando</Button>
    <Button color="error" variant="contained" onClick={onDiscard}>Descartar y cambiar</Button>
  </>}>
    <Typography>Tenés cambios sin guardar en estas reglas. Si cambiás de lenguaje o versión, se pierden.</Typography>
  </ModalWrapper>;
}

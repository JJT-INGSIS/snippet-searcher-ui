import {Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography} from '@mui/material';
import {CloseRounded} from '@mui/icons-material';
import {ReactNode, useId} from 'react';

type Props = {
  open: boolean; onClose: () => void; title: string; description?: string;
  children: ReactNode; actions?: ReactNode; pending?: boolean;
};
export function ModalWrapper({open, onClose, title, description, children, actions, pending = false}: Props) {
  const id = useId();
  return <Dialog open={open} onClose={() => {if (!pending) onClose();}} fullWidth maxWidth="md"
    aria-labelledby={id + '-title'} aria-describedby={description ? id + '-description' : undefined}
    PaperProps={{sx: {m: {xs: 1, sm: 3}, width: {xs: 'calc(100% - 16px)', sm: '100%'}, maxHeight: 'calc(100dvh - 24px)', overscrollBehavior: 'contain'}}}>
    <DialogTitle id={id + '-title'} sx={{pr: 7, pb: 1}}>{title}
      <IconButton aria-label="Cerrar diálogo" disabled={pending} onClick={onClose} sx={{position: 'absolute', right: 12, top: 10}}><CloseRounded/></IconButton>
    </DialogTitle>
    {description && <Typography id={id + '-description'} color="text.secondary" sx={{px: 3, pb: 2}}>{description}</Typography>}
    <DialogContent dividers sx={{display: 'flex', flexDirection: 'column', gap: 2.5}}>{children}</DialogContent>
    {actions && <DialogActions sx={{px: 3, py: 2, flexWrap: 'wrap', gap: 1}}>{actions}</DialogActions>}
  </Dialog>;
}

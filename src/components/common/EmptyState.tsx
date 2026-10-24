import {ReactNode} from 'react';
import {Box, Stack, Typography} from '@mui/material';
import {SearchOffRounded} from '@mui/icons-material';

export function EmptyState({title, description, action}: {title: string; description: string; action?: ReactNode}) {
  return <Stack role="status" alignItems="center" spacing={1.5} sx={{py: 7, px: 3, textAlign: 'center'}}>
    <Box sx={{display: 'grid', placeItems: 'center', p: 1.5, borderRadius: '50%', bgcolor: '#edf4fb', color: 'primary.main'}}>
      <SearchOffRounded fontSize="large"/>
    </Box>
    <Typography component="h2" variant="h2">{title}</Typography>
    <Typography color="text.secondary" sx={{maxWidth: 440}}>{description}</Typography>
    {action}
  </Stack>;
}

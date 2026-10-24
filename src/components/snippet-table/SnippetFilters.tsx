import {Button, InputAdornment, MenuItem, Stack, TextField} from '@mui/material';
import {RestartAltRounded, SearchRounded} from '@mui/icons-material';
import {SnippetFilters as Filters} from '../../utils/snippet';

type Props = {name: string; onName: (name: string) => void; filters: Filters; onFilters: (change: Filters) => void; onClear: () => void};
export function SnippetFilters({name, onName, filters, onFilters, onClear}: Props) {
  return <Stack spacing={2}>
    <Stack direction={{xs: 'column', sm: 'row'}} gap={1.5}>
      <TextField fullWidth label="Buscar por nombre" placeholder="Nombre del snippet…" value={name} onChange={event => onName(event.target.value)}
        InputProps={{startAdornment: <InputAdornment position="start"><SearchRounded/></InputAdornment>}}/>
      <Button variant="outlined" onClick={onClear} startIcon={<RestartAltRounded/>} sx={{flexShrink: 0}}>Limpiar filtros</Button>
    </Stack>
    <Stack direction={{xs: 'column', sm: 'row'}} gap={1.5} sx={{'& > *': {flex: 1, minWidth: 0}}}>
      <TextField select label="Mostrar" value={filters.relation} onChange={event => onFilters({relation: event.target.value as Filters['relation']})}>
        <MenuItem value="all">Propios y compartidos</MenuItem><MenuItem value="owned">Mis snippets</MenuItem><MenuItem value="shared">Compartidos conmigo</MenuItem>
      </TextField>
      <TextField label="Filtrar por lenguaje" placeholder="Por ejemplo, printscript…" value={filters.language ?? ''}
        onChange={event => onFilters({language: event.target.value})}/>
      <TextField select label="Ordenar por" value={filters.sort} onChange={event => onFilters({sort: event.target.value as Filters['sort']})}>
        <MenuItem value="name">Nombre</MenuItem><MenuItem value="language">Lenguaje</MenuItem>
      </TextField>
      <TextField select label="Orden" value={filters.direction} onChange={event => onFilters({direction: event.target.value as Filters['direction']})}>
        <MenuItem value="asc">Ascendente</MenuItem><MenuItem value="desc">Descendente</MenuItem>
      </TextField>
    </Stack>
  </Stack>;
}

import {Box, Button, Stack, TextField, Typography} from '@mui/material';
import {TestDefinitionDraft} from '../../types/TestDefinition';

function OrderedValues({label, singular, values, onChange, disabled = false}: {
  label: string; singular: string; values: string[];
  onChange?: (values: string[]) => void; disabled?: boolean;
}) {
  return <Stack spacing={1.5} component="section" aria-label={label}>
    <Typography variant="subtitle1">{label}</Typography>
    {values.length === 0 && <Typography color="text.secondary">Sin valores: lista vacía.</Typography>}
    {values.map((value, index) => <Stack key={index} direction="row" spacing={1} alignItems="flex-start">
      <TextField fullWidth multiline size="small" label={singular + ' ' + (index + 1)} value={value}
        disabled={disabled} inputProps={{readOnly: !onChange}}
        helperText={value === '' ? 'Cadena vacía (es un valor)' : undefined}
        onChange={event => onChange?.(values.map((current, at) => at === index ? event.target.value : current))}/>
      {onChange && <Button disabled={disabled} aria-label={'Quitar ' + singular.toLowerCase() + ' ' + (index + 1)}
        onClick={() => onChange(values.filter((_, at) => at !== index))}>Quitar</Button>}
    </Stack>)}
    {onChange && <Button disabled={disabled} onClick={() => onChange([...values, ''])} sx={{alignSelf: 'flex-start'}}>
      Agregar {singular.toLowerCase()}
    </Button>}
  </Stack>;
}

export function TabPanel({value, id, title, definition, onChange, disabled = false}: {
  value: string; id: string; title: string; definition: TestDefinitionDraft;
  onChange?: (draft: TestDefinitionDraft) => void; disabled?: boolean;
}) {
  return <Box role="tabpanel" hidden={value !== id} id={'test-panel-' + id} aria-labelledby={'test-tab-' + id} sx={{minWidth: 0, flex: 1}}>
    {value === id && <Stack spacing={2.5}>
      <Typography component="h3" variant="h6">{title}</Typography>
      <OrderedValues label="Inputs" singular="Input" values={definition.inputs} disabled={disabled}
        onChange={onChange ? inputs => onChange({...definition, inputs}) : undefined}/>
      <OrderedValues label="Outputs esperados" singular="Output esperado" values={definition.expectedOutputs} disabled={disabled}
        onChange={onChange ? expectedOutputs => onChange({...definition, expectedOutputs}) : undefined}/>
    </Stack>}
  </Box>;
}

import {FormHelperText, MenuItem, Stack, Switch, TextField, Typography} from '@mui/material';
import {LintRule, LintRuleValue} from '../../utils/api/lintingRules';

const ROW_PADDING = 1.5;
const ROW_SPACING = 2;
const HELP_SPACING = 0.5;
const VALUE_FIELD_WIDTH = 220;
const INTEGER_STEP = 1;
const NO_VALUE = '';

type Props = {rule: LintRule; value: LintRuleValue; problems: string[]; disabled: boolean; onChange: (value: LintRuleValue) => void};

const typedInteger = (rule: LintRule, text: string): LintRuleValue =>
  text.trim() === '' ? (rule.acceptsNull ? null : Number.NaN) : Number(text);
const shownInteger = (value: LintRuleValue): string =>
  typeof value === 'number' && !Number.isNaN(value) ? String(value) : NO_VALUE;

function ValueControl({rule, value, disabled, onChange}: Omit<Props, 'problems'>) {
  const id = 'lint-rule-' + rule.id + '-value';
  if (rule.type === 'boolean') {
    return <Switch checked={value === true} disabled={disabled} inputProps={{'aria-label': rule.id}}
      onChange={event => onChange(event.target.checked)}/>;
  }
  if (rule.type === 'choice') {
    return <TextField select id={id} size="small" label="Valor" value={typeof value === 'string' ? value : NO_VALUE}
      disabled={disabled} sx={{width: VALUE_FIELD_WIDTH}} onChange={event => onChange(event.target.value || null)}>
      {rule.acceptsNull && <MenuItem value={NO_VALUE}>Sin valor</MenuItem>}
      {rule.choices.map(choice => <MenuItem key={choice} value={choice}>{choice}</MenuItem>)}
    </TextField>;
  }
  return <TextField id={id} type="number" size="small" label="Valor" value={shownInteger(value)} disabled={disabled}
    error={value !== null && !Number.isInteger(value)} sx={{width: VALUE_FIELD_WIDTH}}
    helperText={rule.acceptsNull ? 'Vacío: sin valor.' : 'Número entero.'} inputProps={{step: INTEGER_STEP}}
    onChange={event => onChange(typedInteger(rule, event.target.value))}/>;
}

export function LintRuleField({rule, value, problems, disabled, onChange}: Props) {
  return <Stack spacing={HELP_SPACING} component="li" sx={{listStyle: 'none', py: ROW_PADDING}} data-testid={'lint-rule-' + rule.id}>
    <Stack direction={{xs: 'column', sm: 'row'}} spacing={ROW_SPACING} alignItems={{sm: 'center'}}>
      <Typography fontFamily="monospace" sx={{flex: 1, overflowWrap: 'anywhere'}}>{rule.id}</Typography>
      <ValueControl rule={rule} value={value} disabled={disabled} onChange={onChange}/>
    </Stack>
    <FormHelperText component="div">
      {rule.conflictsWith.length > 0 && <Typography variant="body2" color="text.secondary">
        No se combina con: {rule.conflictsWith.join(', ')}.
      </Typography>}
      {problems.map(problem => <Typography key={problem} variant="body2" color="error">{problem}</Typography>)}
    </FormHelperText>
  </Stack>;
}

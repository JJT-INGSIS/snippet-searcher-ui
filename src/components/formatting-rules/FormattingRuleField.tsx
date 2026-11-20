import {FormControlLabel, FormHelperText, Stack, Switch, TextField, Typography} from '@mui/material';
import {FormattingRule, RuleValue} from '../../utils/api/formattingRules';
import {outOfBounds} from '../../utils/formattingDraft';

const ROW_PADDING = 1.5;
const ROW_SPACING = 2;
const HELP_SPACING = 0.5;
const VALUE_FIELD_WIDTH = 160;
const INTEGER_STEP = 1;
const FALLBACK_INTEGER = 0;

type Props = {rule: FormattingRule; value: RuleValue; problems: string[]; disabled: boolean; onChange: (value: RuleValue) => void};

const switchedOn = (rule: FormattingRule): RuleValue => rule.type === 'boolean' ? true : rule.default ?? rule.minimum ?? FALLBACK_INTEGER;
const switchedOff = (rule: FormattingRule): RuleValue => rule.type === 'boolean' ? false : null;
const typed = (text: string): number => text.trim() === '' ? Number.NaN : Number(text);

function bounds(rule: FormattingRule): string {
  if (rule.minimum !== null && rule.maximum !== null) return 'Entre ' + rule.minimum + ' y ' + rule.maximum + '.';
  if (rule.minimum !== null) return 'Mínimo ' + rule.minimum + '.';
  if (rule.maximum !== null) return 'Máximo ' + rule.maximum + '.';
  return 'Número entero.';
}

export function FormattingRuleField({rule, value, problems, disabled, onChange}: Props) {
  const id = 'rule-' + rule.id;
  const on = rule.type === 'boolean' ? value === true : value !== null;
  const wrongNumber = outOfBounds(rule, value);
  return <Stack spacing={HELP_SPACING} component="li" sx={{listStyle: 'none', py: ROW_PADDING}} aria-describedby={id + '-help'}>
    <Stack direction={{xs: 'column', sm: 'row'}} spacing={ROW_SPACING} alignItems={{sm: 'center'}}>
      <FormControlLabel sx={{flex: 1}} label={<Typography fontFamily="monospace">{rule.id}</Typography>}
        control={<Switch checked={on} disabled={disabled}
          onChange={event => onChange(event.target.checked ? switchedOn(rule) : switchedOff(rule))}/>}/>
      {rule.type === 'integer' && on && <TextField id={id + '-value'} type="number" size="small" label="Valor"
        value={Number.isNaN(value) ? '' : String(value)} disabled={disabled} error={wrongNumber}
        helperText={bounds(rule)} sx={{width: VALUE_FIELD_WIDTH}}
        inputProps={{min: rule.minimum ?? undefined, max: rule.maximum ?? undefined, step: INTEGER_STEP}}
        onChange={event => onChange(typed(event.target.value))}/>}
    </Stack>
    <FormHelperText id={id + '-help'} component="div">
      <Typography variant="body2" color="text.secondary">{rule.description}</Typography>
      {rule.conflictsWith.length > 0 && <Typography variant="body2" color="text.secondary">
        No se combina con: {rule.conflictsWith.join(', ')}.
      </Typography>}
      {problems.map(problem => <Typography key={problem} variant="body2" color="error">{problem}</Typography>)}
    </FormHelperText>
  </Stack>;
}

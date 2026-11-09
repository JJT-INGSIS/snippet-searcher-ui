import {MenuItem, Stack, TextField} from '@mui/material';
import {FileType} from '../../types/FileType';
import {RuleScope} from '../rule-settings/useRuleScopeEditor';

const FIELD_SPACING = 2;
const LANGUAGE_FIELD_WIDTH = 200;
const VERSION_FIELD_WIDTH = 160;

type Props = {idPrefix: string; types: FileType[]; scope: RuleScope; disabled: boolean; onChoose: (scope: RuleScope) => void};

export function RuleScopePicker({idPrefix, types, scope, disabled, onChoose}: Props) {
  const versions = types.find(type => type.language === scope.language)?.versions ?? [];
  return <Stack direction={{xs: 'column', sm: 'row'}} spacing={FIELD_SPACING}>
    <TextField select id={idPrefix + '-language'} label="Lenguaje" value={scope.language} disabled={disabled || !types.length}
      sx={{minWidth: LANGUAGE_FIELD_WIDTH}} onChange={event => onChoose({language: event.target.value, version: ''})}>
      {types.map(type => <MenuItem key={type.language} value={type.language}>{type.language}</MenuItem>)}
    </TextField>
    <TextField select id={idPrefix + '-version'} label="Versión" value={scope.version} disabled={disabled || !versions.length}
      sx={{minWidth: VERSION_FIELD_WIDTH}} onChange={event => onChoose({language: scope.language, version: event.target.value})}>
      {versions.map(version => <MenuItem key={version} value={version}>{version}</MenuItem>)}
    </TextField>
  </Stack>;
}

import {MenuItem, Stack, TextField} from '@mui/material';
import {FileType} from '../../types/FileType';
import {versionsOf} from '../../utils/snippet';

export function LanguageVersionFields({types, language, version, disabled, idPrefix = '', onLanguageChange, onVersionChange}: {
  types: FileType[] | undefined; language: string; version: string; disabled: boolean; idPrefix?: string;
  onLanguageChange: (language: string) => void; onVersionChange: (version: string) => void;
}) {
  const versions = versionsOf(types, language);
  return <Stack direction={{xs: 'column', sm: 'row'}} gap={2} sx={{'& > *': {flex: 1, minWidth: 0}}}>
    <TextField select id={idPrefix + 'language'} label="Lenguaje" SelectProps={{labelId: idPrefix + 'language-label'}} value={language}
      disabled={disabled || !types?.length} onChange={event => onLanguageChange(event.target.value)}>
      {types?.map(type => <MenuItem key={type.language} value={type.language}>{type.language}</MenuItem>)}
    </TextField>
    <TextField select id={idPrefix + 'version'} label="Versión" SelectProps={{labelId: idPrefix + 'version-label'}} value={version}
      disabled={disabled || !versions.length} onChange={event => onVersionChange(event.target.value)}>
      {versions.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
    </TextField>
  </Stack>;
}

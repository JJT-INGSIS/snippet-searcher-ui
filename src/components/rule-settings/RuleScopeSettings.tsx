import {ReactNode} from 'react';
import {Alert, Button, CircularProgress, Stack, Typography} from '@mui/material';
import {ApiErrorAlert} from '../common/ApiErrorAlert';
import {JobProgressPanel} from '../jobs/JobProgressPanel';
import {DiscardChangesDialog} from '../formatting-rules/DiscardChangesDialog';
import {RuleScopePicker} from '../formatting-rules/RuleScopePicker';
import {RuleScopeEditor} from './useRuleScopeEditor';
import {JobKind} from '../../utils/jobs/jobPresentation';

const SECTION_SPACING = 2.5;
const ACTION_SPACING = 1.5;
const LOADER_SPACING = 1;
const LOADER_SIZE = 20;

export type RuleField<V> = {value: V; problems: string[]; disabled: boolean; onChange: (value: V) => void};
export type RuleScopeTexts = {list: string; empty: string; unchanged: string};

type Props<V, Rule extends {id: string; value: V}, R extends {changed: boolean; rules: Rule[]}> = {
  editor: RuleScopeEditor<V, Rule, R>;
  idPrefix: string;
  kind: JobKind;
  texts: RuleScopeTexts;
  renderRule: (rule: Rule, field: RuleField<V>) => ReactNode;
  onJobFinished?: () => void;
};

export function RuleScopeSettings<V, Rule extends {id: string; value: V}, R extends {changed: boolean; rules: Rule[]}>(
  {editor, idPrefix, kind, texts, renderRule, onJobFinished}: Props<V, Rule, R>,
) {
  const {rules, save} = editor;
  const saving = save.isLoading;
  const blocked = saving || editor.invalid.length > 0 || (!editor.dirty && !save.error);
  return <Stack spacing={SECTION_SPACING}>
    <ApiErrorAlert error={editor.types.error as Error | null}/>
    <RuleScopePicker idPrefix={idPrefix} types={editor.types.data ?? []} scope={editor.scope} disabled={saving} onChoose={editor.choose}/>
    <JobProgressPanel job={editor.job} kind={kind} onFinished={onJobFinished}/>
    {rules.isLoading && <Stack direction="row" spacing={LOADER_SPACING} alignItems="center">
      <CircularProgress size={LOADER_SIZE}/><Typography>Cargando reglas…</Typography>
    </Stack>}
    <ApiErrorAlert error={rules.error as Error | null}/>
    {rules.data && rules.data.rules.length === 0 && <Alert severity="info">{texts.empty}</Alert>}
    {rules.data && rules.data.rules.length > 0 && <>
      <Stack component="ul" sx={{p: 0, m: 0}} aria-label={texts.list}>
        {rules.data.rules.map(rule => renderRule(rule, {
          value: editor.valueOf(rule), problems: editor.violations[rule.id] ?? [], disabled: saving,
          onChange: value => editor.change(rule.id, value),
        }))}
      </Stack>
      <ApiErrorAlert error={save.error as Error | null} focusOnError/>
      {save.isSuccess && !save.data.changed && <Alert severity="info">{texts.unchanged}</Alert>}
      <Stack direction="row" spacing={ACTION_SPACING}>
        <Button variant="contained" disabled={blocked} onClick={editor.submit}>
          {saving ? 'Guardando…' : save.error ? 'Reintentar guardado' : 'Guardar'}
        </Button>
        <Button disabled={saving || !editor.dirty} onClick={editor.discard}>Descartar cambios</Button>
      </Stack>
    </>}
    <DiscardChangesDialog open={!!editor.requested} onKeep={editor.keep} onDiscard={editor.confirm}/>
  </Stack>;
}

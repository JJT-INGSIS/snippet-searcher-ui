import {LintRuleField} from './LintRuleField';
import {useLintingEditor} from './useLintingEditor';
import {RuleScopeSettings} from '../rule-settings/RuleScopeSettings';
import {useRefreshLintResults} from '../../utils/lintingHooks';

const texts = {
  list: 'Reglas de lint',
  empty: 'Esta versión no tiene reglas de lint configurables.',
  unchanged: 'Las reglas ya tenían esos valores. No hay nada para reevaluar.',
};

export function LintingSettings() {
  const editor = useLintingEditor();
  const refreshResults = useRefreshLintResults();
  return <RuleScopeSettings editor={editor} idPrefix="lint-rules" kind="lint" texts={texts} onJobFinished={refreshResults}
    renderRule={(rule, field) => <LintRuleField key={rule.id} rule={rule} {...field}/>}/>;
}

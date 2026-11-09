import {FormattingRuleField} from './FormattingRuleField';
import {useFormattingEditor} from './useFormattingEditor';
import {RuleScopeSettings} from '../rule-settings/RuleScopeSettings';

const texts = {
  list: 'Reglas de formato',
  empty: 'Esta versión no tiene reglas de formato configurables.',
  unchanged: 'Las reglas ya tenían esos valores. No hay nada para reformatear.',
};

export function FormattingSettings() {
  const editor = useFormattingEditor();
  return <RuleScopeSettings editor={editor} idPrefix="rules" kind="format" texts={texts}
    renderRule={(rule, field) => <FormattingRuleField key={rule.id} rule={rule} {...field}/>}/>;
}

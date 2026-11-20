import {useFormattingJob, useFormattingRules, useSaveFormattingRules} from '../../utils/formattingHooks';
import {invalidInputs} from '../../utils/formattingDraft';
import {useRuleScopeEditor} from '../rule-settings/useRuleScopeEditor';

const formattingSource = {
  useRules: useFormattingRules, useSaveRules: useSaveFormattingRules, useJob: useFormattingJob, invalidInputs,
};

export function useFormattingEditor() {
  return useRuleScopeEditor(formattingSource);
}

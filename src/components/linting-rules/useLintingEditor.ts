import {useLintingJob, useLintingRules, useSaveLintingRules} from '../../utils/lintingHooks';
import {invalidLintInputs} from '../../utils/lintingDraft';
import {useRuleScopeEditor} from '../rule-settings/useRuleScopeEditor';

const lintingSource = {
  useRules: useLintingRules, useSaveRules: useSaveLintingRules, useJob: useLintingJob, invalidInputs: invalidLintInputs,
};

export function useLintingEditor() {
  return useRuleScopeEditor(lintingSource);
}

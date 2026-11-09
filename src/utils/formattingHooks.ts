import {FormattingRules} from './api/formattingRules';
import {FormattingDraft} from './formattingDraft';
import {ruleScopeHooks} from './ruleScopeHooks';

const formatting = ruleScopeHooks<FormattingRules, FormattingDraft>({
  name: 'formatting',
  read: (operations, language, version, signal) => operations.getFormattingRules(language, version, signal),
  save: (operations, language, version, draft) => operations.saveFormattingRules(language, version, draft),
});

export const formattingKeys = formatting.keys;
export const useFormattingRules = formatting.useRules;
export const useFormattingJob = formatting.useJob;

export function useSaveFormattingRules(language: string, version: string) {
  return formatting.useSaveRules(language, version);
}

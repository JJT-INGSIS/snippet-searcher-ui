import {useEffect, useState} from 'react';
import {useGetFileTypes} from '../../utils/queries';
import {useFormattingJob, useFormattingRules, useSaveFormattingRules} from '../../utils/formattingHooks';
import {FormattingDraft, draftOf, invalidInputs, isDirty, violationMessages, withValue} from '../../utils/formattingDraft';
import {RuleValue} from '../../utils/api/formattingRules';
import {ApiError} from '../../utils/api/errors';

export type RuleScope = {language: string; version: string};

export function useFormattingEditor() {
  const types = useGetFileTypes();
  const [scope, setScope] = useState<RuleScope>({language: '', version: ''});
  const [requested, setRequested] = useState<RuleScope | null>(null);
  const [draft, setDraft] = useState<FormattingDraft>({});
  const rules = useFormattingRules(scope.language, scope.version);
  const save = useSaveFormattingRules(scope.language, scope.version);
  const job = useFormattingJob(scope.language, scope.version);
  const first = types.data?.[0];
  const loaded = rules.data?.rules ?? [];
  const dirty = isDirty(draft, loaded);

  useEffect(() => {
    if (!scope.language && first) setScope({language: first.language, version: first.versions[0] ?? ''});
  }, [scope.language, first]);
  useEffect(() => {
    if (rules.data) setDraft(draftOf(rules.data.rules));
  }, [rules.data]);

  const apply = (next: RuleScope) => {
    save.reset();
    setRequested(null);
    setScope(next);
  };

  return {
    types, scope, rules, draft, dirty, job, save, requested,
    invalid: invalidInputs(draft, loaded),
    violations: save.error instanceof ApiError ? violationMessages(save.error.problem?.violations ?? []) : {},
    change: (id: string, value: RuleValue) => setDraft(current => withValue(current, id, value)),
    choose: (next: RuleScope) => dirty ? setRequested(next) : apply(next),
    confirm: () => {if (requested) apply(requested);},
    keep: () => setRequested(null),
    discard: () => setDraft(draftOf(loaded)),
    submit: () => save.mutate(draft),
  };
}

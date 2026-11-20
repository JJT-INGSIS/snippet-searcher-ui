import {useEffect, useState} from 'react';
import {UseMutationResult, UseQueryResult} from 'react-query';
import {useGetFileTypes} from '../../utils/queries';
import {draftOf, isDirty, violationMessages, withValue} from '../../utils/formattingDraft';
import {ApiError} from '../../utils/api/errors';
import {TrackedJob} from '../../utils/jobs/useJobProgress';

export type RuleScope = {language: string; version: string};
type EditableRule<V> = {id: string; value: V};
type SavedScope<Rule> = {changed: boolean; rules: Rule[]};

export type RuleScopeSource<V, Rule extends EditableRule<V>, R extends SavedScope<Rule>> = {
  useRules: (language: string, version: string) => UseQueryResult<R>;
  useSaveRules: (language: string, version: string) => UseMutationResult<R, unknown, Record<string, V>>;
  useJob: (language: string, version: string) => TrackedJob | undefined;
  invalidInputs: (draft: Record<string, V>, rules: Rule[]) => string[];
};

export function useRuleScopeEditor<V, Rule extends EditableRule<V>, R extends SavedScope<Rule>>(
  source: RuleScopeSource<V, Rule, R>,
) {
  const types = useGetFileTypes();
  const [scope, setScope] = useState<RuleScope>({language: '', version: ''});
  const [requested, setRequested] = useState<RuleScope | null>(null);
  const [draft, setDraft] = useState<Record<string, V>>({});
  const rules = source.useRules(scope.language, scope.version);
  const save = source.useSaveRules(scope.language, scope.version);
  const job = source.useJob(scope.language, scope.version);
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
    invalid: source.invalidInputs(draft, loaded),
    violations: save.error instanceof ApiError ? violationMessages(save.error.problem?.violations ?? []) : {},
    valueOf: (rule: Rule): V => rule.id in draft ? draft[rule.id] : rule.value,
    change: (id: string, value: V) => setDraft(current => withValue(current, id, value)),
    choose: (next: RuleScope) => dirty ? setRequested(next) : apply(next),
    confirm: () => {if (requested) apply(requested);},
    keep: () => setRequested(null),
    discard: () => setDraft(draftOf(loaded)),
    submit: () => save.mutate(draft),
  };
}

export type RuleScopeEditor<V, Rule extends EditableRule<V>, R extends SavedScope<Rule>> =
  ReturnType<typeof useRuleScopeEditor<V, Rule, R>>;

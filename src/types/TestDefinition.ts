// SNI-45: a definition is ordered data, not an execution or a set of chips.
export type TestDefinitionDraft = {inputs: string[]; expectedOutputs: string[]};
export type TestDefinition = TestDefinitionDraft & {id: string; snippetId: string};

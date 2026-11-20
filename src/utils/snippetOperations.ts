import {AutomaticTests} from './api/automaticTests';
import {PaginatedSnippets, Share, Snippet, SnippetFilters, SnippetMetadata, UpdateSnippet} from './snippet';
import {PaginatedUsers} from './users';
import {TestCase} from '../types/TestCase';
import {FileType} from '../types/FileType';
import {CreationIntent} from './api/creationIntent';
import {TestDefinition, TestDefinitionDraft} from '../types/TestDefinition';
import {FormattingRules, RuleValue} from './api/formattingRules';
import {LintingRules, LintRuleValue} from './api/lintingRules';
import {JobProgress} from './jobs/jobProgress';
import {FormattedSnippet} from './api/formattedSnippet';
// Boundary retained from the supplied UI. Unsupported operations reject explicitly.
export interface SnippetOperations {
  listSnippetDescriptors(page: number, pageSize: number, filters?: SnippetFilters, signal?: AbortSignal): Promise<PaginatedSnippets>;
  createSnippet(intent: CreationIntent): Promise<SnippetMetadata>;
  getSnippetById(id: string): Promise<Snippet>;
  updateSnippetById(id: string, input: UpdateSnippet): Promise<SnippetMetadata>;
  getUserFriends(name?: string, page?: number, pageSize?: number, signal?: AbortSignal): Promise<PaginatedUsers>;
  shareSnippet(snippetId: string, userId: string): Promise<Share>;
  getFileTypes(): Promise<FileType[]>;
  getFormattingRules(language: string, version: string, signal?: AbortSignal): Promise<FormattingRules>;
  saveFormattingRules(language: string, version: string, draft: Record<string, RuleValue>): Promise<FormattingRules>;
  getJobProgress(jobId: string, signal?: AbortSignal): Promise<JobProgress>;
  getFormattedSnippet(snippetId: string): Promise<FormattedSnippet>;
  getLintingRules(language: string, version: string, signal?: AbortSignal): Promise<LintingRules>;
  saveLintingRules(language: string, version: string, draft: Record<string, LintRuleValue>): Promise<LintingRules>;
  getAutomaticTests(snippetId: string, signal?: AbortSignal): Promise<AutomaticTests>;
  listTestDefinitions(snippetId: string, signal?: AbortSignal): Promise<TestDefinition[]>;
  formatSnippet(snippet: string): Promise<string>;
  createTestDefinition(snippetId: string, testCase: TestDefinitionDraft): Promise<TestDefinition>;
  removeTestCase(id: string): Promise<string>;
  deleteSnippet(id: string): Promise<string>;
  testSnippet(testCase: Partial<TestCase>): Promise<'success' | 'fail'>;
}

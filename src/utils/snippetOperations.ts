import {PaginatedSnippets, Share, Snippet, SnippetFilters, SnippetMetadata, UpdateSnippet} from './snippet';
import {PaginatedUsers} from './users';
import {TestCase} from '../types/TestCase';
import {FileType} from '../types/FileType';
import {Rule} from '../types/Rule';
import {CreationIntent} from './api/creationIntent';
import {TestDefinition, TestDefinitionDraft} from '../types/TestDefinition';
// Boundary retained from the supplied UI. Unsupported operations reject explicitly.
export interface SnippetOperations {
  listSnippetDescriptors(page: number, pageSize: number, filters?: SnippetFilters, signal?: AbortSignal): Promise<PaginatedSnippets>;
  createSnippet(intent: CreationIntent): Promise<SnippetMetadata>;
  getSnippetById(id: string): Promise<Snippet>;
  updateSnippetById(id: string, input: UpdateSnippet): Promise<SnippetMetadata>;
  getUserFriends(name?: string, page?: number, pageSize?: number, signal?: AbortSignal): Promise<PaginatedUsers>;
  shareSnippet(snippetId: string, userId: string): Promise<Share>;
  getFileTypes(): Promise<FileType[]>;
  getFormatRules(): Promise<Rule[]>;
  getLintingRules(): Promise<Rule[]>;
  listTestDefinitions(snippetId: string, signal?: AbortSignal): Promise<TestDefinition[]>;
  formatSnippet(snippet: string): Promise<string>;
  createTestDefinition(snippetId: string, testCase: TestDefinitionDraft): Promise<TestDefinition>;
  removeTestCase(id: string): Promise<string>;
  deleteSnippet(id: string): Promise<string>;
  testSnippet(testCase: Partial<TestCase>): Promise<'success' | 'fail'>;
  modifyFormatRule(rules: Rule[]): Promise<Rule[]>;
  modifyLintingRule(rules: Rule[]): Promise<Rule[]>;
}

import {Pagination} from './pagination';
import {FileType} from '../types/FileType';
import {LintResult, LintStatus} from './api/lintResult';
export type CreateSnippet = {name: string; description: string | null; language: string; version: string; content: string};
export type UpdateSnippet = CreateSnippet;
export type SnippetDraft = Pick<CreateSnippet, 'name' | 'content' | 'language'>;
// POST and PUT acknowledge metadata; they never return a readable detail.
export type SnippetMetadata = Omit<CreateSnippet, 'content'> & {id: string};
export type SnippetDescriptor = SnippetMetadata & {
  extension: string; author: string; relation: 'owned' | 'shared'; lint: LintResult;
};
export type Snippet = SnippetDescriptor & {content: string; capabilities: {modify: boolean; share: boolean}};
export type Share = {snippetId: string; userId: string};
export type PaginatedSnippets = Pagination & {snippets: SnippetDescriptor[]};
export type SnippetFilters = {
  name?: string; language?: string; relation?: 'all' | 'owned' | 'shared'; lint?: LintStatus;
  sort?: 'name' | 'language' | 'lint'; direction?: 'asc' | 'desc';
};
export const getFileLanguage = (types: FileType[], extension?: string) => types.find(t => t.extension === extension);

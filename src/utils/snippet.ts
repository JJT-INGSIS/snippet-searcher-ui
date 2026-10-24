import {Pagination} from './pagination';
import {FileType} from '../types/FileType';
export type ComplianceEnum = 'not-implemented' | 'pending' | 'failed' | 'not-compliant' | 'compliant';
export type CreateSnippet = {name: string; description: string | null; language: string; version: string; content: string};
export type UpdateSnippet = CreateSnippet;
export type SnippetDraft = Pick<CreateSnippet, 'name' | 'content' | 'language'>;
// POST and PUT acknowledge metadata; they never return a readable detail.
export type SnippetMetadata = Omit<CreateSnippet, 'content'> & {id: string};
export type SnippetDescriptor = SnippetMetadata & {
  extension: string; author: string; relation: 'owned' | 'shared'; compliance: ComplianceEnum;
};
export type Snippet = SnippetDescriptor & {content: string; capabilities: {modify: boolean; share: boolean}};
export type Share = {snippetId: string; userId: string};
export type PaginatedSnippets = Pagination & {snippets: SnippetDescriptor[]};
export type SnippetFilters = {
  name?: string; language?: string; relation?: 'all' | 'owned' | 'shared';
  sort?: 'name' | 'language'; direction?: 'asc' | 'desc';
};
export const getFileLanguage = (types: FileType[], extension?: string) => types.find(t => t.extension === extension);

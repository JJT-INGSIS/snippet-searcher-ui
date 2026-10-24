import {ComplianceEnum, CreateSnippet, PaginatedSnippets, Snippet, SnippetDescriptor, SnippetMetadata} from '../snippet';
import {ApiError} from './errors';
import {PaginatedUsers} from '../users';
import {FileType} from '../../types/FileType';
export type WriteSnippetDto = Omit<CreateSnippet, 'content'> & {code: string};
export type MetadataDto = Omit<WriteSnippetDto, 'code'> & {id: string};
export type DescriptorDto = MetadataDto & {
  extension: string; ownerId: string; relation: 'owned' | 'shared'; lint: {status: ComplianceEnum};
};
export type DetailDto = DescriptorDto & {code: string; capabilities: Snippet['capabilities']};
export type SnippetPageDto = {page: number; page_size: number; count: number; snippets: DescriptorDto[]};
export const invalidResponse = () => new ApiError('Unexpected API response. The operation was not confirmed.', undefined, true);
const nonblank = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
export const toWriteDto = (input: CreateSnippet): WriteSnippetDto => ({
  name: input.name, description: input.description, language: input.language, version: input.version, code: input.content,
});
export function fromMetadataDto(dto: MetadataDto): SnippetMetadata {
  if (!dto || ![dto.id, dto.name, dto.language, dto.version].every(nonblank) ||
      !(dto.description === null || typeof dto.description === 'string')) throw invalidResponse();
  return {id: dto.id, name: dto.name, description: dto.description, language: dto.language, version: dto.version};
}
export function fromDescriptorDto(dto: DescriptorDto): SnippetDescriptor {
  const metadata = fromMetadataDto(dto);
  if (!nonblank(dto.ownerId) || !nonblank(dto.extension) || !['owned', 'shared'].includes(dto.relation) ||
      !['not-implemented', 'pending', 'failed', 'not-compliant', 'compliant'].includes(dto.lint?.status)) throw invalidResponse();
  return {...metadata, extension: dto.extension, author: dto.ownerId, relation: dto.relation, compliance: dto.lint.status};
}
export function fromDetailDto(dto: DetailDto): Snippet {
  const descriptor = fromDescriptorDto(dto);
  if (typeof dto.code !== 'string' || typeof dto.capabilities?.modify !== 'boolean' ||
      typeof dto.capabilities?.share !== 'boolean') throw invalidResponse();
  return {...descriptor, content: dto.code, capabilities: {...dto.capabilities}};
}
export function fromPageDto(dto: SnippetPageDto): PaginatedSnippets {
  if (!dto || !Number.isInteger(dto.page) || dto.page < 0 || !Number.isInteger(dto.page_size) ||
      dto.page_size < 1 || !Number.isInteger(dto.count) || dto.count < 0 || !Array.isArray(dto.snippets)) throw invalidResponse();
  return {page: dto.page, page_size: dto.page_size, count: dto.count, snippets: dto.snippets.map(fromDescriptorDto)};
}
export function fromLanguagesDto(dto: FileType[]): FileType[] {
  if (!Array.isArray(dto) || dto.some(type => !type || !nonblank(type.language) || !nonblank(type.extension) ||
      !Array.isArray(type.versions) || !type.versions.every(nonblank))) throw invalidResponse();
  return dto.map(type => ({language: type.language, extension: type.extension, versions: [...type.versions]}));
}

export function fromUsersDto(dto: PaginatedUsers): PaginatedUsers {
  if (!dto || !Number.isInteger(dto.page) || dto.page < 0 || !Number.isInteger(dto.page_size) ||
      dto.page_size < 1 || !Number.isInteger(dto.count) || dto.count < 0 || !Array.isArray(dto.users) ||
      dto.users.some(user => !user || !nonblank(user.id) || !nonblank(user.name))) throw invalidResponse();
  return {page: dto.page, page_size: dto.page_size, count: dto.count, users: dto.users.map(user => ({id: user.id, name: user.name}))};
}

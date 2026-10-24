import axios, {AxiosInstance} from 'axios';
import {RuntimeConfig, actorScope, parseRuntimeConfig} from './config';
import {ApiError, toApiError, unsupported} from './errors';
import {SnippetOperations} from '../snippetOperations';
import {DetailDto, MetadataDto, SnippetPageDto, fromDetailDto, fromMetadataDto, fromPageDto, toWriteDto, fromLanguagesDto, fromUsersDto, invalidResponse} from './dto';
import {PaginatedUsers} from '../users';
import {Share} from '../snippet';
import {FileType} from '../../types/FileType';
export function createApiClient(config: RuntimeConfig): AxiosInstance {
  const validated = parseRuntimeConfig(config);
  const client = axios.create({baseURL: '/api', timeout: 15000});
  client.interceptors.request.use(request => {
    if (request.url !== '/languages' && validated.identity.mode === 'dev') request.headers.set('X-Dev-Actor-Id', validated.identity.actorId);
    return request;
  });
  client.interceptors.response.use(response => response, (error: unknown) => Promise.reject(toApiError(error)));
  return client;
}
export function createHttpSnippetOperations(client: AxiosInstance, actorId: string): SnippetOperations {
  return {
    async listSnippetDescriptors(page, pageSize, filters = {}) {
      return fromPageDto((await client.get<SnippetPageDto>('/snippets', {params: {page, page_size: pageSize, ...filters}})).data);
    },
    async createSnippet(intent) {
      if (intent.actorId !== actorId) throw new ApiError('The creation belongs to another identity.');
      const response = await client.post<MetadataDto>('/snippets', toWriteDto(intent.payload), {headers: {'Idempotency-Key': intent.key}});
      if (![200, 201].includes(response.status)) throw invalidResponse();
      return fromMetadataDto(response.data);
    },
    async getSnippetById(id) {
      return fromDetailDto((await client.get<DetailDto>('/snippets/' + encodeURIComponent(id))).data);
    },
    async updateSnippetById(id, input) {
      const response = await client.put<MetadataDto>('/snippets/' + encodeURIComponent(id), toWriteDto(input));
      if (response.status !== 200 || response.data?.id !== id) throw invalidResponse();
      return fromMetadataDto(response.data);
    },
    async getUserFriends(name = '', page = 0, pageSize = 10) {
      return fromUsersDto((await client.get<PaginatedUsers>('/users', {params: {name, page, page_size: pageSize}})).data);
    },
    async shareSnippet(id, userId) {
      const {data, status} = await client.put<Share>('/snippets/' + encodeURIComponent(id) + '/shares/' + encodeURIComponent(userId));
      if (![200, 201].includes(status) || data?.snippetId !== id || data?.userId !== userId) throw invalidResponse();
      return {snippetId: data.snippetId, userId: data.userId};
    },
    async getFileTypes() {return fromLanguagesDto((await client.get<FileType[]>('/languages')).data);},
    getFormatRules: unsupported, getLintingRules: unsupported, getTestCases: unsupported,
    formatSnippet: unsupported, postTestCase: unsupported, removeTestCase: unsupported,
    deleteSnippet: unsupported, testSnippet: unsupported, modifyFormatRule: unsupported, modifyLintingRule: unsupported,
  };
}
export function configuredApi(config: RuntimeConfig) {
  const actor = actorScope(config);
  return {actor, operations: createHttpSnippetOperations(createApiClient(config), actor)};
}

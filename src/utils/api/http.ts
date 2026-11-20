import {fromAutomaticTests} from './automaticTests';
import axios, {AxiosInstance} from 'axios';
import {RuntimeConfig} from './config';
import {RequestIdentity, isSameOriginApiPath, staticIdentity} from '../auth/requestIdentity';
import {createExecutionHttp} from './executionHttp';
import {ExecutionSession} from '../executionSession';
import {ApiError, toApiError, unsupported} from './errors';
import {SnippetOperations} from '../snippetOperations';
import {DetailDto, MetadataDto, SnippetPageDto, fromDetailDto, fromMetadataDto, fromPageDto, toWriteDto, fromLanguagesDto, fromUsersDto, invalidResponse} from './dto';
import {PaginatedUsers} from '../users';
import {Share} from '../snippet';
import {FileType} from '../../types/FileType';
import {fromTestDefinition, fromTestDefinitions, toTestDefinitionDraft} from './testDefinitions';
import {fromFormattingRulesDto, toFormattingRulesBody} from './formattingRules';
import {fromJobProgressDto} from '../jobs/jobProgress';
import {fromFormattedSnippetDto} from './formattedSnippet';
import {fromLintingRulesDto, toLintingRulesBody} from './lintingRules';
const rulesPath = (resource: 'formatting-rules' | 'linting-rules', language: string, version: string) =>
  '/' + resource + '/' + encodeURIComponent(language) + '/' + encodeURIComponent(version);
const PUBLIC_PATHS = ['/languages'];
const UNAUTHORIZED = 401;

export function createApiClient(config: RuntimeConfig, identity: RequestIdentity = staticIdentity(config)): AxiosInstance {
  const client = axios.create({baseURL: '/api', timeout: 15000});
  client.interceptors.request.use(async request => {
    if (!isSameOriginApiPath(request.url) || PUBLIC_PATHS.includes(request.url)) return request;
    Object.entries(await identity.headers()).forEach(([name, value]) => request.headers.set(name, value));
    return request;
  });
  client.interceptors.response.use(response => response, (error: unknown) => {
    const replacement = axios.isAxiosError(error) && error.response?.status === UNAUTHORIZED ? identity.unauthorized() : null;
    return Promise.reject(replacement ?? (axios.isCancel(error) ? error : toApiError(error)));
  });
  return client;
}
export function createHttpSnippetOperations(client: AxiosInstance, actorId: string): SnippetOperations {
  return {
    async listSnippetDescriptors(page, pageSize, filters = {}, signal) {
      return fromPageDto((await client.get<SnippetPageDto>('/snippets', {params: {page, page_size: pageSize, ...filters}, signal})).data);
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
    async getUserFriends(name = '', page = 0, pageSize = 10, signal) {
      return fromUsersDto((await client.get<PaginatedUsers>('/users', {params: {name, page, page_size: pageSize}, signal})).data);
    },
    async shareSnippet(id, userId) {
      const {data, status} = await client.put<Share>('/snippets/' + encodeURIComponent(id) + '/shares/' + encodeURIComponent(userId));
      if (![200, 201].includes(status) || data?.snippetId !== id || data?.userId !== userId) throw invalidResponse();
      return {snippetId: data.snippetId, userId: data.userId};
    },
    async getFileTypes() {return fromLanguagesDto((await client.get<FileType[]>('/languages')).data);},
    async getAutomaticTests(snippetId, signal) {
      const response = await client.get('/snippets/' + encodeURIComponent(snippetId) + '/automatic-tests', {signal});
      if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.headers['content-type'] ?? '')) throw invalidResponse();
      return fromAutomaticTests(response.data);
    },
    async listTestDefinitions(snippetId, signal) {
      const response = await client.get('/snippets/' + encodeURIComponent(snippetId) + '/tests', {signal});
      if (response.status !== 200 || !/^application\/json(?:;|$)/i.test(response.headers['content-type'] ?? '')) throw invalidResponse();
      return fromTestDefinitions(response.data, snippetId);
    },
    async createTestDefinition(snippetId, input) {
      const draft = toTestDefinitionDraft(input);
      const response = await client.post('/snippets/' + encodeURIComponent(snippetId) + '/tests', draft);
      if (response.status !== 201 || !/^application\/json(?:;|$)/i.test(response.headers['content-type'] ?? '')) throw invalidResponse();
      const saved = fromTestDefinition(response.data, snippetId);
      if (JSON.stringify(saved.inputs) !== JSON.stringify(draft.inputs) ||
          JSON.stringify(saved.expectedOutputs) !== JSON.stringify(draft.expectedOutputs)) throw invalidResponse();
      return saved;
    },
    async getFormattingRules(language, version, signal) {
      return fromFormattingRulesDto((await client.get(rulesPath('formatting-rules', language, version), {signal})).data, language, version);
    },
    async saveFormattingRules(language, version, draft) {
      const response = await client.put(rulesPath('formatting-rules', language, version), toFormattingRulesBody(draft));
      if (response.status !== 200) throw invalidResponse();
      return fromFormattingRulesDto(response.data, language, version);
    },
    async getJobProgress(jobId, signal) {
      return fromJobProgressDto((await client.get('/jobs/' + encodeURIComponent(jobId), {signal})).data, jobId);
    },
    async getFormattedSnippet(snippetId) {
      const response = await client.get('/snippets/' + encodeURIComponent(snippetId) + '/formatted');
      if (response.status !== 200) throw invalidResponse();
      return fromFormattedSnippetDto(response.data, snippetId);
    },
    async getLintingRules(language, version, signal) {
      return fromLintingRulesDto((await client.get(rulesPath('linting-rules', language, version), {signal})).data, language, version);
    },
    async saveLintingRules(language, version, draft) {
      const response = await client.put(rulesPath('linting-rules', language, version), toLintingRulesBody(draft));
      if (response.status !== 200) throw invalidResponse();
      return fromLintingRulesDto(response.data, language, version);
    },
    formatSnippet: unsupported, removeTestCase: unsupported,
    deleteSnippet: unsupported, testSnippet: unsupported,
  };
}
export function configuredApi(config: RuntimeConfig, identity: RequestIdentity = staticIdentity(config)) {
  const operations = createHttpSnippetOperations(createApiClient(config, identity), identity.actor);
  return {actor: identity.actor, operations, execution: new ExecutionSession(createExecutionHttp(config, undefined, identity))};
}

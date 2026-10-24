// Opt-in local verification: requires real Snippets/Permissions/PrintScript and databases.
// It leaves one clearly named snippet in the local database; it never calls a VM.
import {expect, it} from 'vitest';
import {createApiClient, createHttpSnippetOperations} from '../src/utils/api/http';
import {createCreationIntent} from '../src/utils/api/creationIntent';
it('verifies real POST/replay/conflict, full PUT and parser errors through the Vite /api proxy', async () => {
  const config = {environment: 'dev' as const, identity: {mode: 'dev' as const, actorId: 'dev-juanfran'}};
  const client = createApiClient(config);
  client.defaults.baseURL = 'http://127.0.0.1:5173/api'; client.defaults.proxy = false;
  const statuses: number[] = [];
  client.interceptors.response.use(response => {statuses.push(response.status); return response;});
  const api = createHttpSnippetOperations(client, 'dev-juanfran');
  const input = {name: 'SNI-34 adapter smoke ' + new Date().toISOString(), description: null, language: 'printscript', version: '1.0', content: 'println(1);'};
  const intent = createCreationIntent(input, 'dev-juanfran');
  const created = await api.createSnippet(intent);
  expect(created).toMatchObject({name: input.name, language: 'printscript', version: '1.0'});
  expect(created).not.toHaveProperty('content'); expect(created).not.toHaveProperty('author');
  expect(await api.createSnippet(intent)).toEqual(created);
  expect(statuses.slice(0, 2)).toEqual([201, 200]);
  await expect(api.createSnippet({...intent, payload: {...input, name: 'different'}}))
    .rejects.toMatchObject({problem: {status: 409, type: 'urn:snippets:problem:creation-conflict'}});
  expect(await api.updateSnippetById(created.id, {...input, description: 'Updated by SNI-34 local smoke', content: 'println(2);'}))
    .toMatchObject({id: created.id, description: 'Updated by SNI-34 local smoke'});
  await expect(api.createSnippet(createCreationIntent({...input, content: 'let x: number = ;'}, 'dev-juanfran')))
    .rejects.toMatchObject({problem: {status: 422, type: 'urn:snippets:problem:invalid-code', diagnostics: expect.any(Array)}});
  console.info('Real local backend verified: snippet=' + created.id + ', POST=201, replay=200, conflict=409, PUT=200, parser=422.');
}, 60000);

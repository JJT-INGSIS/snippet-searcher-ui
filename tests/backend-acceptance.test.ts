// Opt-in SNI-36 acceptance. Every /api request reaches the real providers.
import {randomUUID} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {expect, it} from 'vitest';
import {createApiClient, createHttpSnippetOperations} from '../src/utils/api/http';
import {createCreationIntent} from '../src/utils/api/creationIntent';

const phase = process.env.SNI36_PHASE;
if (phase && !['healthy', 'permissions-down', 'storage-down', 'metadata-write-failure', 'after-recreate'].includes(phase)) {
  throw new Error('Unknown SNI36_PHASE; refusing to report acceptance without running its checks.');
}
const evidenceFile = process.env.SNI36_EVIDENCE_FILE;
const apiUrl = process.env.SNI36_API_URL || 'http://127.0.0.1:5173/api';
const target = new URL(apiUrl);
if (phase && (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname))) {
  throw new Error('SNI-36 writes test data and requires a local HTTP endpoint.');
}
const actors = {owner: 'dev-thiago', reader: 'dev-ana', outsider: 'dev-bruno'};
const clients = Object.fromEntries(Object.entries(actors).map(([role, actorId]) => {
  const client = createApiClient({environment: 'dev', identity: {mode: 'dev', actorId}});
  client.defaults.baseURL = apiUrl;
  client.defaults.proxy = false;
  return [role, client];
}));
const owner = createHttpSnippetOperations(clients.owner, actors.owner);
const reader = createHttpSnippetOperations(clients.reader, actors.reader);
const outsider = createHttpSnippetOperations(clients.outsider, actors.outsider);
type Evidence = {id: string; prefix: string; name: string; description: string; code: string; otherId: string; readerId: string};
async function evidence(): Promise<Evidence> {
  if (!evidenceFile) throw new Error('Set SNI36_EVIDENCE_FILE to an external evidence file.');
  return JSON.parse(await readFile(evidenceFile, 'utf8'));
}
const payload = (name: string, code: string) => ({name, description: null, language: 'printscript', version: '1.1', content: code});
async function assertPreserved(record: Evidence) {
  const saved = {name: record.name, description: record.description, language: 'printscript', version: '1.1', content: record.code};
  expect(await owner.getSnippetById(record.id)).toMatchObject({...saved, relation: 'owned', capabilities: {modify: true, share: true}});
  expect(await reader.getSnippetById(record.id)).toMatchObject({...saved, relation: 'shared', capabilities: {modify: false, share: false}});
  await expect(outsider.getSnippetById(record.id)).rejects.toMatchObject({problem: {status: 404}});
  const page = await reader.listSnippetDescriptors(0, 10, {name: record.prefix, relation: 'all'});
  expect(page.count).toBe(2);
  expect(new Set(page.snippets.map(item => item.id))).toEqual(new Set([record.id, record.readerId]));
}

it.skipIf(phase !== 'healthy')('SNI-36: real three-actor creation, coherent update, sharing, filtering and pagination', async () => {
  if (!evidenceFile) throw new Error('Set SNI36_EVIDENCE_FILE outside the repository.');
  const prefix = 'SNI36-' + randomUUID();
  const input = payload(prefix + '-a', 'println("original ñ");\n');
  const created = await owner.createSnippet(createCreationIntent(input, actors.owner));
  const other = await owner.createSnippet(createCreationIntent(payload(prefix + '-b', 'println(2);'), actors.owner));
  const readersOwn = await reader.createSnippet(createCreationIntent(payload(prefix + '-reader', 'println(3);'), actors.reader));
  const firstCode = 'println("actualizado ñ 🙂");\nprintln(4);\n';
  await owner.updateSnippetById(created.id, {...input, content: firstCode});
  const code = firstCode + 'println(5);\n';
  const changing = owner.updateSnippetById(created.id, {...input, description: 'SNI36 revision 2', content: code});
  const observations = await Promise.all(Array.from({length: 8}, () => owner.getSnippetById(created.id)));
  await changing;
  for (const observation of observations) {
    expect([{description: null, content: firstCode}, {description: 'SNI36 revision 2', content: code}])
      .toContainEqual({description: observation.description, content: observation.content});
  }
  const users = await owner.getUserFriends('Ana');
  expect(users.users).toContainEqual({id: actors.reader, name: 'Ana'});
  const sharePath = '/snippets/' + created.id + '/shares/' + actors.reader;
  expect((await clients.owner.put(sharePath)).status).toBe(201);
  expect((await clients.owner.put(sharePath)).status).toBe(200);
  const first = await owner.listSnippetDescriptors(0, 1, {name: prefix, relation: 'owned', sort: 'name', direction: 'asc'});
  const second = await owner.listSnippetDescriptors(1, 1, {name: prefix, relation: 'owned', sort: 'name', direction: 'asc'});
  expect(first.count).toBe(2); expect(second.count).toBe(2);
  expect(first.snippets.map(item => item.id)).toEqual([created.id]);
  expect(second.snippets.map(item => item.id)).toEqual([other.id]);
  expect((await owner.listSnippetDescriptors(0, 10, {name: prefix, relation: 'owned', direction: 'desc'})).snippets.map(item => item.id))
    .toEqual([other.id, created.id]);
  expect((await owner.listSnippetDescriptors(0, 10, {name: prefix, language: 'missing'})).count).toBe(0);
  expect((await reader.listSnippetDescriptors(0, 10, {name: prefix, relation: 'shared'})).snippets.map(item => item.id)).toEqual([created.id]);
  expect((await outsider.listSnippetDescriptors(0, 10, {name: prefix, relation: 'all'})).count).toBe(0);
  await expect(reader.updateSnippetById(created.id, {...input, content: 'println(99);'})).rejects.toMatchObject({problem: {status: 403}});
  await expect(reader.shareSnippet(created.id, actors.outsider)).rejects.toMatchObject({problem: {status: 403}});
  const record = {id: created.id, prefix, name: created.name, description: 'SNI36 revision 2', code, otherId: other.id, readerId: readersOwn.id};
  await assertPreserved(record);
  await writeFile(evidenceFile, JSON.stringify(record, null, 2) + '\n', {mode: 0o600});
  console.info('SNI-36 healthy: real snippet=' + created.id + '; three actors, Asset, update, read-only and counts verified.');
}, 120000);

it.skipIf(phase !== 'permissions-down')('SNI-36: Permissions outage is a technical error, not empty list or successful share', async () => {
  const record = await evidence();
  await expect(owner.listSnippetDescriptors(0, 10, {name: record.prefix})).rejects.toMatchObject({problem: {status: 502, type: 'urn:snippets:problem:dependency-failure'}});
  await expect(owner.shareSnippet(record.id, actors.outsider)).rejects.toMatchObject({problem: {status: 502, type: 'urn:snippets:problem:dependency-failure'}});
  await expect(reader.getSnippetById(record.id)).rejects.toMatchObject({problem: {status: 502, type: 'urn:snippets:problem:dependency-failure'}});
}, 60000);

it.skipIf(phase !== 'storage-down')('SNI-36: Asset outage cannot confirm update or hide the last committed metadata', async () => {
  const record = await evidence();
  await expect(owner.getSnippetById(record.id)).rejects.toMatchObject({problem: {status: 503, type: 'urn:snippets:problem:storage-unavailable'}});
  await expect(owner.updateSnippetById(record.id, payload(record.name + '-must-not-commit', 'println(999);')))
    .rejects.toMatchObject({problem: {status: 503, type: 'urn:snippets:problem:storage-unavailable'}});
  const page = await owner.listSnippetDescriptors(0, 10, {name: record.prefix});
  expect(page.count).toBe(2);
  expect(page.snippets.find(item => item.id === record.id)?.name).toBe(record.name);
}, 60000);

it.skipIf(phase !== 'after-recreate')('SNI-36: content, metadata and read-only sharing survive service/database/blob recreation', async () => {
  await assertPreserved(await evidence());
}, 60000);

it.skipIf(phase !== 'metadata-write-failure')('SNI-36: a real PostgreSQL write rejection preserves the previous committed code and sharing', async () => {
  const record = await evidence();
  // The local operator installs a CHECK constraint for this exact test record/name.
  // Asset remains real and available: failure occurs after preparing the new content.
  await expect(owner.updateSnippetById(record.id, payload(record.name + '-must-not-commit', 'println(999);')))
    .rejects.toMatchObject({problem: {status: 503, type: 'urn:snippets:problem:metadata-unavailable'}});
  await assertPreserved(record);
}, 60000);

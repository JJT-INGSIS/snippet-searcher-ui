import {describe, expect, it} from 'vitest';
import {actorScope, parseRuntimeConfig} from './config';
import {snippetKeys} from '../queries';
describe('runtime identity and query isolation', () => {
  it('only enables dev identity explicitly in dev, independent of bundle mode', () => {
    expect(actorScope(parseRuntimeConfig({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}}))).toBe('dev-juan');
    expect(() => parseRuntimeConfig({environment: 'prod', identity: {mode: 'dev', actorId: 'dev-juan'}})).toThrow();
    expect(() => parseRuntimeConfig({environment: 'dev', identity: {mode: 'dev', actorId: ' '}})).toThrow();
    expect(() => parseRuntimeConfig({})).toThrow();
    expect(actorScope(parseRuntimeConfig({environment: 'prod', identity: {mode: 'disabled'}}))).toBe('identity-disabled');
  });
  it('separates lists, detail and users by actor, pagination and filters', () => {
    expect(snippetKeys.detail('a', 'id')).not.toEqual(snippetKeys.detail('b', 'id'));
    expect(snippetKeys.users('a', '', 0, 5)).not.toEqual(snippetKeys.users('b', '', 0, 5));
    expect(snippetKeys.list('a', 0, 10, {relation: 'owned'})).not.toEqual(snippetKeys.list('a', 0, 10, {relation: 'shared'}));
    expect(snippetKeys.list('a', 0, 10, {})).not.toEqual(snippetKeys.list('a', 1, 10, {}));
  });
});

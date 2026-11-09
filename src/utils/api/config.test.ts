import {describe, expect, it} from 'vitest';
import {actorScope, issuerOf, parseRuntimeConfig} from './config';
import {snippetKeys} from '../queries';

const auth0 = {
  mode: 'auth0', domain: 'jjt-snippet-searcher.us.auth0.com', clientId: 'BDuvRyQ6ryyye08Bs9ZEfRzw7AsskFs6',
  audience: 'https://jjt-snippets-dev.duckdns.org/api',
};

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

describe('auth0 runtime configuration', () => {
  it('accepts only the public Auth0 parameters in dev and prod', () => {
    expect(parseRuntimeConfig({environment: 'dev', identity: auth0}).identity).toEqual(auth0);
    expect(parseRuntimeConfig({environment: 'prod', identity: auth0}).identity).toEqual(auth0);
    expect(issuerOf(auth0 as Parameters<typeof issuerOf>[0])).toBe('https://jjt-snippet-searcher.us.auth0.com/');
  });

  it('drops anything that is not one of the three public parameters', () => {
    const parsed = parseRuntimeConfig({environment: 'dev', identity: {...auth0, clientSecret: 'never', actorId: 'dev-juan'}});
    expect(parsed.identity).toEqual(auth0);
  });

  it.each([
    ['a domain with scheme', {...auth0, domain: 'https://jjt-snippet-searcher.us.auth0.com'}],
    ['a domain with path', {...auth0, domain: 'jjt-snippet-searcher.us.auth0.com/evil'}],
    ['a domain with port', {...auth0, domain: 'jjt-snippet-searcher.us.auth0.com:443'}],
    ['a domain with credentials', {...auth0, domain: 'user@evil.com'}],
    ['an uppercase domain', {...auth0, domain: 'JJT.us.auth0.com'}],
    ['a short client id', {...auth0, clientId: 'abc'}],
    ['a client id with symbols', {...auth0, clientId: 'BDuvRyQ6ryyye08Bs9ZEfRzw7AsskF"s6'}],
    ['an http audience', {...auth0, audience: 'http://jjt-snippets-dev.duckdns.org/api'}],
    ['an audience with query', {...auth0, audience: 'https://jjt-snippets-dev.duckdns.org/api?x=1'}],
    ['an audience with fragment', {...auth0, audience: 'https://jjt-snippets-dev.duckdns.org/api#x'}],
    ['an audience with credentials', {...auth0, audience: 'https://user:pass@jjt-snippets-dev.duckdns.org/api'}],
    ['a javascript audience', {...auth0, audience: 'javascript:alert(1)'}],
    ['a missing audience', {...auth0, audience: undefined}],
    ['an unknown mode', {...auth0, mode: 'auth0-test'}],
  ])('rejects %s instead of falling back to another mode', (_, identity) => {
    expect(() => parseRuntimeConfig({environment: 'dev', identity})).toThrow();
  });
});

import {describe, expect, it} from 'vitest';
import {QueryClient} from 'react-query';
import {snippetKeys} from './queries';

describe('test query scope', () => {
  it('does not share test data between snippets or actors', () => {
    const cache = new QueryClient();
    const key = snippetKeys.tests('actor-a', 'snippet-a');
    cache.setQueryData(key, ['private test']);
    expect(cache.getQueryData(snippetKeys.tests('actor-a', 'snippet-b'))).toBeUndefined();
    expect(cache.getQueryData(snippetKeys.tests('actor-b', 'snippet-a'))).toBeUndefined();
    expect(cache.getQueryData(key)).toEqual(['private test']);
    cache.clear();
  });
});

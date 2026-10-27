import {describe, expect, it, vi} from 'vitest';
import {createCreationIntent} from './creationIntent';
describe('creation intent', () => {
  it('snapshots data and generates a key once per logical creation', () => {
    const input = {name: 'Example', description: null, language: 'printscript', version: '1.0', content: 'println(1);'};
    const next = vi.fn().mockReturnValueOnce('first').mockReturnValueOnce('second');
    const first = createCreationIntent(input, 'dev-juan', next);
    input.content = 'changed';
    expect(first.payload.content).toBe('println(1);');
    expect(Object.isFrozen(first.payload)).toBe(true);
    expect(Object.isFrozen(first)).toBe(true);
    expect(first.key).toBe('first');
    expect(createCreationIntent(input, 'dev-juan', next).key).toBe('second');
    expect(next).toHaveBeenCalledTimes(2);
  });
});

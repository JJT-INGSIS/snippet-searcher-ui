import {describe, expect, it} from 'vitest';
import {safeReturnTo} from './returnPaths';

describe('return path after login', () => {
  it('keeps the screens of the app', () => {
    expect(safeReturnTo('/')).toBe('/');
    expect(safeReturnTo('/rules')).toBe('/rules');
  });

  it.each([
    '//evil.com', 'https://evil.com', 'http://127.0.0.1:5173/rules', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)',
    '/%2F%2Fevil.com', '/rules?next=https://evil.com', '/rules#x', '/rules/../admin', '/unknown', '', ' /rules', '/RULES',
  ])('sends %j back to the home screen', value => {
    expect(safeReturnTo(value)).toBe('/');
  });

  it.each([undefined, null, 1, {returnTo: '/rules'}, ['/rules']])('ignores %j', value => {
    expect(safeReturnTo(value)).toBe('/');
  });
});

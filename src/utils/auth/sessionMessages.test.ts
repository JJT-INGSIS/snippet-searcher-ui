import {describe, expect, it} from 'vitest';
import {initialsOf, sessionFailureMessage} from './sessionMessages';

describe('session messages', () => {
  it('explains known login failures with fixed texts', () => {
    expect(sessionFailureMessage('access_denied')).toContain('Se canceló');
    expect(sessionFailureMessage('missing_transaction')).toContain('no es válido');
  });

  it('never echoes an unknown code or inherited property names', () => {
    expect(sessionFailureMessage('<script>alert(1)</script>')).toBe('Ocurrió un problema al iniciar sesión.');
    expect(sessionFailureMessage('toString')).toBe('Ocurrió un problema al iniciar sesión.');
    expect(sessionFailureMessage(null)).toBe('Ocurrió un problema al iniciar sesión.');
  });

  it('builds initials for the avatar from a name or an email', () => {
    expect(initialsOf('Ana Gómez')).toBe('AG');
    expect(initialsOf('juan.rudolph@mail.com')).toBe('JR');
    expect(initialsOf('')).toBe('?');
  });
});

import {describe, expect, it, vi} from 'vitest';
import {bearerIdentity, isSameOriginApiPath, needsLogin, staticIdentity} from './requestIdentity';
import {parseRuntimeConfig} from '../api/config';

const auth0Config = parseRuntimeConfig({environment: 'dev', identity: {
  mode: 'auth0', domain: 'jjt-snippet-searcher.us.auth0.com', clientId: 'BDuvRyQ6ryyye08Bs9ZEfRzw7AsskFs6',
  audience: 'https://jjt-snippets-dev.duckdns.org/api',
}});

describe('request identity', () => {
  it('sends the explicit dev actor only in dev mode and nothing when identity is disabled', async () => {
    const dev = staticIdentity(parseRuntimeConfig({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}}));
    const disabled = staticIdentity(parseRuntimeConfig({environment: 'prod', identity: {mode: 'disabled'}}));

    expect(await dev.headers()).toEqual({'X-Dev-Actor-Id': 'dev-juan'});
    expect(await disabled.headers()).toEqual({});
  });

  it('never builds a fixed identity for auth0: it needs a signed-in session', () => {
    expect(() => staticIdentity(auth0Config)).toThrow();
  });

  it('asks for a fresh token on every request and never sends the dev header', async () => {
    const tokens = ['first', 'second'];
    const accessToken = vi.fn(async () => tokens.shift() ?? '');
    const identity = bearerIdentity({actor: 'issuer|sub', accessToken, expired: vi.fn()});

    expect(await identity.headers()).toEqual({Authorization: 'Bearer first'});
    expect(await identity.headers()).toEqual({Authorization: 'Bearer second'});
    expect(accessToken).toHaveBeenCalledTimes(2);
  });

  it.each(['login_required', 'consent_required', 'interaction_required', 'missing_refresh_token'])(
    'turns %s into an expired session without sending the request', async code => {
      const expired = vi.fn();
      const identity = bearerIdentity({actor: 'a', accessToken: () => Promise.reject({error: code}), expired});

      await expect(identity.headers()).rejects.toMatchObject({problem: {type: 'urn:snippets:problem:session-expired', status: 401}});
      expect(expired).toHaveBeenCalledTimes(1);
    });

  it('reports an unreachable login service without expiring the session or leaking the cause', async () => {
    const expired = vi.fn();
    const identity = bearerIdentity({actor: 'a', accessToken: () => Promise.reject(new Error('secret detail')), expired});

    await expect(identity.headers()).rejects.toMatchObject({problem: {type: 'urn:snippets:problem:session-unavailable'}, uncertain: false});
    await expect(identity.headers()).rejects.not.toMatchObject({message: expect.stringContaining('secret')});
    expect(expired).not.toHaveBeenCalled();
  });

  it('turns a rejected token into an expired session and keeps the dev answer for a fixed identity', () => {
    const expired = vi.fn();
    const bearer = bearerIdentity({actor: 'a', accessToken: async () => 't', expired});
    const dev = staticIdentity(parseRuntimeConfig({environment: 'dev', identity: {mode: 'dev', actorId: 'dev-juan'}}));

    expect(bearer.unauthorized()).toMatchObject({problem: {type: 'urn:snippets:problem:session-expired'}});
    expect(expired).toHaveBeenCalledTimes(1);
    expect(dev.unauthorized()).toBeNull();
  });

  it('treats an empty token as unavailable', async () => {
    const identity = bearerIdentity({actor: 'a', accessToken: async () => '', expired: vi.fn()});

    await expect(identity.headers()).rejects.toMatchObject({problem: {type: 'urn:snippets:problem:session-unavailable'}});
  });

  it('recognizes only the errors that need the user to sign in again', () => {
    expect(needsLogin({error: 'login_required'})).toBe(true);
    expect(needsLogin({error: 'timeout'})).toBe(false);
    expect(needsLogin(new Error('login_required'))).toBe(false);
    expect(needsLogin(undefined)).toBe(false);
  });

  it('only treats relative paths of this app as API paths', () => {
    expect(isSameOriginApiPath('/snippets')).toBe(true);
    expect(isSameOriginApiPath('https://evil.com/snippets')).toBe(false);
    expect(isSameOriginApiPath('//evil.com/snippets')).toBe(false);
    expect(isSameOriginApiPath('/\\evil.com')).toBe(false);
    expect(isSameOriginApiPath('snippets')).toBe(false);
    expect(isSameOriginApiPath(undefined)).toBe(false);
  });
});

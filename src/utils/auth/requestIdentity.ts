import {RuntimeConfig, actorScope, parseRuntimeConfig} from '../api/config';
import {ApiError} from '../api/errors';

export type RequestIdentity = {
  actor: string;
  headers: () => Promise<Record<string, string>>;
  unauthorized: () => ApiError | null;
};

const interactionRequired = ['login_required', 'consent_required', 'interaction_required', 'missing_refresh_token', 'invalid_grant'];
const keepOriginalError = () => null;

export const sessionExpired = () =>
  new ApiError('La sesión venció.', {type: 'urn:snippets:problem:session-expired', status: 401}, false);
const sessionUnavailable = () =>
  new ApiError('No se pudo obtener la sesión.', {type: 'urn:snippets:problem:session-unavailable', status: 0}, false);

export function needsLogin(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'error' in error && interactionRequired.includes(String(error.error));
}

export function staticIdentity(config: RuntimeConfig): RequestIdentity {
  const validated = parseRuntimeConfig(config);
  const identity = validated.identity;
  if (identity.mode === 'auth0') throw new Error('Auth0 identity requires a signed-in session');
  const headers: Record<string, string> = identity.mode === 'dev' ? {'X-Dev-Actor-Id': identity.actorId} : {};
  return {actor: actorScope(validated), headers: async () => ({...headers}), unauthorized: keepOriginalError};
}

type BearerSource = {actor: string; accessToken: () => Promise<string>; expired: () => void};

export function bearerIdentity({actor, accessToken, expired}: BearerSource): RequestIdentity {
  return {
    actor,
    unauthorized: () => {
      expired();
      return sessionExpired();
    },
    async headers() {
      try {
        const token = await accessToken();
        if (!token) throw sessionUnavailable();
        return {Authorization: 'Bearer ' + token};
      } catch (error) {
        if (needsLogin(error)) {
          expired();
          throw sessionExpired();
        }
        throw sessionUnavailable();
      }
    },
  };
}

export const isSameOriginApiPath = (url: string | undefined): url is string =>
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') && !url.includes('\\');

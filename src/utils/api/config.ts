export type Auth0Identity = {mode: 'auth0'; domain: string; clientId: string; audience: string};
export type RuntimeConfig = {
  environment: 'dev' | 'prod';
  identity: {mode: 'disabled'} | {mode: 'dev'; actorId: string} | Auth0Identity;
};

const MAX_CLIENT_ID = 128;
const MIN_CLIENT_ID = 16;
const domainFormat = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const clientIdFormat = new RegExp('^[A-Za-z0-9_-]{' + MIN_CLIENT_ID + ',' + MAX_CLIENT_ID + '}$');

function isAudience(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.search && !url.hash &&
      url.href.startsWith(value);
  } catch {
    return false;
  }
}

function auth0Identity(identity: Record<string, unknown>): Auth0Identity {
  const {domain, clientId, audience} = identity;
  if (typeof domain !== 'string' || !domainFormat.test(domain) || typeof clientId !== 'string' ||
      !clientIdFormat.test(clientId) || !isAudience(audience)) {
    throw new Error('Auth0 identity requires a valid domain, clientId and https audience');
  }
  return {mode: 'auth0', domain, clientId, audience};
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid app-config.json');
  const config = value as RuntimeConfig;
  if (!['dev', 'prod'].includes(config.environment) || !config.identity || typeof config.identity !== 'object') {
    throw new Error('Invalid runtime configuration');
  }
  if (config.identity.mode === 'disabled') return {environment: config.environment, identity: {mode: 'disabled'}};
  if (config.identity.mode === 'auth0') {
    return {environment: config.environment, identity: auth0Identity(config.identity as unknown as Record<string, unknown>)};
  }
  if (config.environment === 'dev' && config.identity.mode === 'dev' &&
      typeof config.identity.actorId === 'string' && config.identity.actorId.trim() && !/[\r\n]/.test(config.identity.actorId)) {
    return {environment: 'dev', identity: {mode: 'dev', actorId: config.identity.actorId}};
  }
  throw new Error('Dev identity requires an explicit dev environment and actor');
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/app-config.json', {cache: 'no-store'});
  if (!response.ok) throw new Error('Could not load app-config.json');
  return parseRuntimeConfig(await response.json());
}

export const actorScope = (config: RuntimeConfig) => config.identity.mode === 'dev' ? config.identity.actorId : 'identity-disabled';

export const issuerOf = (identity: Auth0Identity) => 'https://' + identity.domain + '/';

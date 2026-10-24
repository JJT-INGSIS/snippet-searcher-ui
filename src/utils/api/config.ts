export type RuntimeConfig = {
  environment: 'dev' | 'prod';
  identity: {mode: 'disabled'} | {mode: 'dev'; actorId: string};
};
export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  if (!value || typeof value !== 'object') throw new Error('Invalid app-config.json');
  const config = value as RuntimeConfig;
  if (!['dev', 'prod'].includes(config.environment) || !config.identity) throw new Error('Invalid runtime configuration');
  if (config.identity.mode === 'disabled') return {environment: config.environment, identity: {mode: 'disabled'}};
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

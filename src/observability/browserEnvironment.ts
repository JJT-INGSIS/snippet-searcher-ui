import {RuntimeConfig} from '../utils/api/config';
import {ALLOWED_RETURN_PATHS} from '../utils/auth/returnPaths';

type PageLocation = Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>;

const origins = {
  dev: 'https://jjt-snippets-dev.duckdns.org',
  prod: 'https://jjt-snippets-prod.duckdns.org',
};

export function browserEnvironment(config: RuntimeConfig, page: PageLocation): 'dev' | 'prod' | null {
  if (config.identity.mode !== 'auth0' || page.origin !== origins[config.environment] ||
      !ALLOWED_RETURN_PATHS.includes(page.pathname) || page.search || page.hash) return null;
  return config.environment;
}

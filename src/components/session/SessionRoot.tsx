import {ReactNode} from 'react';
import {Auth0Provider} from '@auth0/auth0-react';
import {RuntimeConfig} from '../../utils/api/config';
import {CALLBACK_PATH, absoluteAppUrl, safeReturnTo} from '../../utils/auth/returnPaths';
import {router} from '../../appRouter';
import {Auth0Session} from './Auth0Session';
import {StaticSession} from './StaticSession';

const AUTH_SCOPE = 'openid profile email';

export function SessionRoot({config, children}: {config: RuntimeConfig; children: ReactNode}) {
  if (config.identity.mode !== 'auth0') return <StaticSession config={config}>{children}</StaticSession>;
  const identity = config.identity;
  return <Auth0Provider domain={identity.domain} clientId={identity.clientId} cacheLocation="memory" useRefreshTokens={false}
    authorizationParams={{redirect_uri: absoluteAppUrl(CALLBACK_PATH), audience: identity.audience, scope: AUTH_SCOPE}}
    skipRedirectCallback={window.location.pathname !== CALLBACK_PATH}
    onRedirectCallback={appState => void router.navigate(safeReturnTo(appState?.returnTo), {replace: true})}>
    <Auth0Session config={config} identity={identity}>{children}</Auth0Session>
  </Auth0Provider>;
}

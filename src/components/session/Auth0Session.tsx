import {ReactNode, useCallback, useEffect, useMemo, useState} from 'react';
import {useAuth0} from '@auth0/auth0-react';
import {Auth0Identity, RuntimeConfig, issuerOf} from '../../utils/api/config';
import {bearerIdentity} from '../../utils/auth/requestIdentity';
import {HOME_PATH, LOGOUT_RETURN_PATH, absoluteAppUrl, safeReturnTo} from '../../utils/auth/returnPaths';
import {forgetPrivateData} from '../../utils/queryClient';
import {ReauthOutcome, Session, SessionContext, SessionStatus, SessionUser} from './SessionContext';
import {useIdentityApi} from './useIdentityApi';

type Props = {config: RuntimeConfig; identity: Auth0Identity; children: ReactNode};

const codeOf = (error: unknown) =>
  error && typeof error === 'object' && 'error' in error && typeof error.error === 'string' ? error.error : null;

const safePicture = (picture: unknown) =>
  typeof picture === 'string' && picture.startsWith('https://') ? picture : null;

function popupOutcome(error: unknown): ReauthOutcome {
  if (codeOf(error) === 'cancelled') return 'cancelled';
  if (error instanceof Error && error.message.includes('Unable to open a popup')) return 'blocked';
  return 'failed';
}

export function Auth0Session({config, identity, children}: Props) {
  const auth = useAuth0();
  const {getAccessTokenSilently, loginWithRedirect, loginWithPopup, logout} = auth;
  const [expired, setExpired] = useState(false);
  const markExpired = useCallback(() => setExpired(true), []);
  const subject = auth.isAuthenticated && typeof auth.user?.sub === 'string' ? auth.user.sub : null;
  const actor = subject ? issuerOf(identity) + '|' + subject : null;
  const requestIdentity = useMemo(() => actor
    ? bearerIdentity({actor, accessToken: () => getAccessTokenSilently(), expired: markExpired})
    : null, [actor, getAccessTokenSilently, markExpired]);
  const api = useIdentityApi(config, requestIdentity);

  useEffect(() => setExpired(false), [actor]);

  const name = auth.user?.name || auth.user?.email || 'Tu cuenta';
  const email = auth.user?.email ?? null;
  const picture = safePicture(auth.user?.picture);
  const user = useMemo<SessionUser | null>(() => subject ? {name, email, picture} : null, [subject, name, email, picture]);
  const status: SessionStatus = auth.isLoading ? 'checking' : auth.error ? 'failed' : actor && api ? 'signed-in' : 'signed-out';

  const session = useMemo<Session>(() => ({
    kind: 'auth0', status, actor, user, api, expired,
    failure: auth.error ? codeOf(auth.error) ?? 'unknown' : null,
    login: returnTo => void loginWithRedirect({appState: {returnTo: safeReturnTo(returnTo)}}),
    signup: () => void loginWithRedirect({appState: {returnTo: HOME_PATH}, authorizationParams: {screen_hint: 'signup'}}),
    logout: () => {
      api?.execution.release();
      forgetPrivateData();
      void logout({logoutParams: {returnTo: absoluteAppUrl(LOGOUT_RETURN_PATH)}});
    },
    reauthenticate: async () => {
      try {
        await loginWithPopup();
        setExpired(false);
        return 'signed-in';
      } catch (error) {
        return popupOutcome(error);
      }
    },
    dismissExpired: () => setExpired(false),
  }), [status, actor, user, api, expired, auth.error, loginWithRedirect, loginWithPopup, logout]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

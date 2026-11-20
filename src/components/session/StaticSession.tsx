import {ReactNode, useMemo} from 'react';
import {RuntimeConfig} from '../../utils/api/config';
import {staticIdentity} from '../../utils/auth/requestIdentity';
import {Session, SessionContext} from './SessionContext';
import {useIdentityApi} from './useIdentityApi';

const ignore = () => undefined;

export function StaticSession({config, children}: {config: RuntimeConfig; children: ReactNode}) {
  const identity = useMemo(() => staticIdentity(config), [config]);
  const api = useIdentityApi(config, identity);
  const kind = config.identity.mode === 'dev' ? 'dev' : 'disabled';
  const session = useMemo<Session>(() => ({
    kind, status: 'signed-in', actor: identity.actor, api, failure: null, expired: false,
    user: kind === 'dev' ? {name: identity.actor, email: null, picture: null} : null,
    login: ignore, signup: ignore, logout: null, dismissExpired: ignore,
    reauthenticate: async () => 'signed-in',
  }), [kind, identity, api]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

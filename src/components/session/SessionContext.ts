import {createContext, useContext} from 'react';
import {configuredApi} from '../../utils/api/http';

export type SessionApi = ReturnType<typeof configuredApi>;
export type SessionKind = 'auth0' | 'dev' | 'disabled';
export type SessionStatus = 'checking' | 'signed-out' | 'signed-in' | 'failed';
export type SessionUser = {name: string; email: string | null; picture: string | null};
export type ReauthOutcome = 'signed-in' | 'blocked' | 'cancelled' | 'failed';

export type Session = {
  kind: SessionKind;
  status: SessionStatus;
  actor: string | null;
  user: SessionUser | null;
  api: SessionApi | null;
  failure: string | null;
  expired: boolean;
  login: (returnTo?: string) => void;
  signup: () => void;
  logout: (() => void) | null;
  reauthenticate: () => Promise<ReauthOutcome>;
  dismissExpired: () => void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Missing session');
  return session;
}

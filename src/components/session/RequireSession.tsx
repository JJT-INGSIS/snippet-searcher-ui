import {ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import {ApiContext} from '../../contexts/apiContext';
import {useSession} from './SessionContext';
import {SessionExpiredDialog} from './SessionExpiredDialog';
import {SessionFailureScreen, SessionWaitingScreen, WelcomeScreen} from '../../screens/SessionGateScreens';

export function RequireSession({children}: {children: ReactNode}) {
  const session = useSession();
  const {pathname} = useLocation();
  if (session.status === 'checking') return <SessionWaitingScreen message="Verificando tu sesión…"/>;
  if (session.status === 'failed') return <SessionFailureScreen/>;
  if (session.status === 'signed-out' || !session.api || !session.actor) return <WelcomeScreen returnTo={pathname}/>;
  return <ApiContext.Provider key={session.actor} value={session.api}>
    {children}
    {session.kind === 'auth0' && <SessionExpiredDialog/>}
  </ApiContext.Provider>;
}

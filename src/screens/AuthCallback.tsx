import {useEffect} from 'react';
import {Navigate, useNavigate} from 'react-router-dom';
import {useSession} from '../components/session/SessionContext';
import {CALLBACK_PATH, HOME_PATH} from '../utils/auth/returnPaths';
import {SessionFailureScreen, SessionWaitingScreen} from './SessionGateScreens';

export function AuthCallbackScreen() {
  const session = useSession();
  const navigate = useNavigate();
  const failed = session.status === 'failed';
  useEffect(() => {
    if (failed) navigate(CALLBACK_PATH, {replace: true});
  }, [failed, navigate]);
  if (session.kind !== 'auth0') return <Navigate to={HOME_PATH} replace/>;
  if (session.status === 'checking') return <SessionWaitingScreen message="Completando el inicio de sesión…"/>;
  if (failed) return <SessionFailureScreen/>;
  return <Navigate to={HOME_PATH} replace/>;
}

import {createBrowserRouter} from 'react-router-dom';
import HomeScreen from './screens/Home';
import RulesScreen from './screens/Rules';
import {RequireSession} from './components/session/RequireSession';
import {AuthCallbackScreen} from './screens/AuthCallback';
import {NotFoundScreen} from './screens/NotFound';
import {AppErrorScreen} from './screens/AppError';
import {CALLBACK_PATH} from './utils/auth/returnPaths';

export const router = createBrowserRouter([
  {path: '/', element: <RequireSession><HomeScreen/></RequireSession>, errorElement: <AppErrorScreen/>},
  {path: '/rules', element: <RequireSession><RulesScreen/></RequireSession>, errorElement: <AppErrorScreen/>},
  {path: CALLBACK_PATH, element: <AuthCallbackScreen/>, errorElement: <AppErrorScreen/>},
  {path: '*', element: <NotFoundScreen/>, errorElement: <AppErrorScreen/>},
]);

import './App.css';
import {RouterProvider} from 'react-router-dom';
import {QueryClientProvider} from 'react-query';
import {router} from './appRouter';
import {queryClient} from './utils/queryClient';

export {queryClient};

const App = () => <QueryClientProvider client={queryClient}><RouterProvider router={router}/></QueryClientProvider>;

export default App;

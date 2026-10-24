import {createContext, useContext} from 'react';
import {configuredApi} from '../utils/api/http';
export const ApiContext = createContext<ReturnType<typeof configuredApi> | null>(null);
export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error('Missing API configuration');
  return api;
}

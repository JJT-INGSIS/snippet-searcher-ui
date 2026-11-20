import {QueryClient} from 'react-query';

export const queryClient = new QueryClient();

export function forgetPrivateData() {
  void queryClient.cancelQueries();
  queryClient.getMutationCache().clear();
  queryClient.clear();
}

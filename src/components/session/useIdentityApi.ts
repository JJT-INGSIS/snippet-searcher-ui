import {useLayoutEffect, useMemo} from 'react';
import {RuntimeConfig} from '../../utils/api/config';
import {configuredApi} from '../../utils/api/http';
import {RequestIdentity} from '../../utils/auth/requestIdentity';
import {forgetPrivateData} from '../../utils/queryClient';

export function useIdentityApi(config: RuntimeConfig, identity: RequestIdentity | null) {
  const api = useMemo(() => identity ? configuredApi(config, identity) : null, [config, identity]);
  useLayoutEffect(() => {
    if (!api) return undefined;
    api.execution.attach();
    return () => {
      api.execution.release();
      forgetPrivateData();
    };
  }, [api]);
  return api;
}

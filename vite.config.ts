import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';

function localIdentity(env: Record<string, string>) {
  const auth0 = [env.UI_AUTH_DOMAIN, env.UI_AUTH_CLIENT_ID, env.UI_AUTH_AUDIENCE];
  if (auth0.some(Boolean)) {
    if (env.UI_DEV_ACTOR) throw new Error('UI_DEV_ACTOR cannot be combined with the Auth0 variables');
    return {mode: 'auth0', domain: env.UI_AUTH_DOMAIN, clientId: env.UI_AUTH_CLIENT_ID, audience: env.UI_AUTH_AUDIENCE};
  }
  return env.UI_DEV_ACTOR ? {mode: 'dev', actorId: env.UI_DEV_ACTOR} : {mode: 'disabled'};
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const identity = localIdentity(env);
  return {
    plugins: [react(), {
      name: 'local-runtime-config',
      configureServer(server) {
        server.middlewares.use('/app-config.json', (_request, response) => {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({environment: 'dev', identity}));
        });
      },
    }],
    server: {host: '127.0.0.1', proxy: {
      '/api': {target: env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true,
        rewrite: path => path.replace(/^\/api(?=\/|$)/, '')},
    }},
  };
});

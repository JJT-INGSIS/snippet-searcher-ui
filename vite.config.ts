import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), {
      name: 'local-runtime-config',
      configureServer(server) {
        server.middlewares.use('/app-config.json', (_request, response) => {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify({environment: 'dev', identity: env.UI_DEV_ACTOR
            ? {mode: 'dev', actorId: env.UI_DEV_ACTOR} : {mode: 'disabled'}}));
        });
      },
    }],
    server: {host: '127.0.0.1', proxy: {
      '/api': {target: env.API_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true,
        rewrite: path => path.replace(/^\/api(?=\/|$)/, '')},
    }},
  };
});

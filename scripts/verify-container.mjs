// Actual packaged UI, one image with two environments. No VM or business data.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';

const docker = (...args) => execFileSync('docker', args, {encoding: 'utf8', timeout: 300_000}).trim();
const context = process.env.DOCKER_CONTEXT || docker('context', 'show');
const endpoint = process.env.DOCKER_CONTEXT || !process.env.DOCKER_HOST
  ? JSON.parse(docker('context', 'inspect', context))[0].Endpoints.docker.Host : process.env.DOCKER_HOST;
assert(endpoint.startsWith('unix://') || (process.platform === 'win32' && endpoint === 'npipe:////./pipe/dockerDesktopLinuxEngine'), 'Local Docker only');
assert.equal(docker('info', '--format', '{{.OSType}}'), 'linux');
const prefix = `sni42-${randomUUID().slice(0, 12)}`;
const image = process.env.UI_TEST_IMAGE || `${prefix}:test`;
const containers = [];
let built = false;
try {
  if (process.env.UI_TEST_IMAGE) docker('image', 'inspect', image);
  else {
    docker('build', '--platform', 'linux/amd64', '-t', image, '.');
    built = true;
  }
  let bundle;
  const auth0 = {domain: 'jjt-snippet-searcher.us.auth0.com', clientId: 'BDuvRyQ6ryyye08Bs9ZEfRzw7AsskFs6',
    audience: 'https://jjt-snippets-dev.duckdns.org/api'};
  const auth0Settings = [`UI_AUTH_DOMAIN=${auth0.domain}`, `UI_AUTH_CLIENT_ID=${auth0.clientId}`, `UI_AUTH_AUDIENCE=${auth0.audience}`];
  const runs = [
    {label: 'dev', environment: 'dev', settings: ['UI_DEV_ACTOR=dev-juanfran'], identity: {mode: 'dev', actorId: 'dev-juanfran'}},
    {label: 'prod', environment: 'prod', settings: ['UI_DEV_ACTOR='], identity: {mode: 'disabled'}},
    {label: 'prod-auth0', environment: 'prod', settings: auth0Settings, identity: {mode: 'auth0', ...auth0}},
  ];
  for (const {label, environment, settings, identity} of runs) {
    const name = `${prefix}-${label}`;
    docker('run', '-d', '--name', name, '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
      '-p', '127.0.0.1::8080', '-e', `APP_ENV=${environment}`, ...settings.flatMap(value => ['-e', value]), image);
    containers.push(name);
    const info = JSON.parse(docker('inspect', name))[0];
    const base = `http://127.0.0.1:${info.NetworkSettings.Ports['8080/tcp'][0].HostPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { ready = (await fetch(`${base}/healthz`)).ok; } catch { /* Starting. */ }
      if (ready) break;
      await wait(250);
    }
    assert(ready, `${environment} did not start`);
    assert.notEqual(docker('exec', name, 'id', '-u'), '0');
    const config = await fetch(`${base}/app-config.json`);
    assert.equal(config.headers.get('cache-control'), 'no-store');
    assert.match(config.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await config.json(), {environment, identity});
    const page = await fetch(base);
    for (const response of [page, config]) {
      assert.equal(response.headers.get('x-frame-options'), 'DENY');
      assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('referrer-policy'), 'same-origin');
    }
    const html = await page.text();
    assert.equal(await (await fetch(`${base}/editor/a-snippet`)).text(), html);
    const script = html.match(/src="([^"]+\.js)"/)[1];
    const code = await (await fetch(base + script)).text();
    assert(code.length > 0);
    if (bundle) assert.equal(code, bundle, 'Bundle changed between environments');
    bundle = code;
    for (const path of ['/api', '/api/missing', '/assets/missing.js']) assert.equal((await fetch(base + path)).status, 404);
    assert.equal(JSON.parse(docker('inspect', name))[0].Image, info.Image);
    console.log(`PASS packaged UI ${label}: runtime config, security headers, non-root, SPA, static/API errors`);
  }
  for (const settings of [['APP_ENV=invalid'], ['APP_ENV=prod', 'UI_DEV_ACTOR=dev-juan'],
    ['APP_ENV=dev', 'UI_DEV_ACTOR=bad"actor'], ['APP_ENV=dev', 'UI_DEV_ACTOR=dev-juan', ...auth0Settings],
    ['APP_ENV=prod', `UI_AUTH_DOMAIN=${auth0.domain}`], ['APP_ENV=prod', ...auth0Settings, 'UI_AUTH_DOMAIN=https://evil.example'],
    ['APP_ENV=prod', ...auth0Settings, 'UI_AUTH_AUDIENCE=http://jjt-snippets-dev.duckdns.org/api'],
    ['APP_ENV=prod', ...auth0Settings, 'UI_AUTH_AUDIENCE=https://evil.example/api?x="1"'],
    ['APP_ENV=prod', ...auth0Settings, 'UI_AUTH_CLIENT_ID=short']]) {
    assert.throws(() => docker('run', '--rm', ...settings.flatMap(value => ['-e', value]), image), 'Invalid runtime config must fail startup');
  }
} finally {
  for (const name of containers) docker('rm', '-f', name);
  // Only this randomly named acceptance image; no application volumes/prune.
  if (built) docker('image', 'rm', image);
}

import {describe, expect, it, vi} from 'vitest';
import {RuntimeConfig} from '../utils/api/config';
import {browserEnvironment} from './browserEnvironment';

const createAgent = vi.hoisted(() => vi.fn());
vi.mock('@newrelic/browser-agent/loaders/agent', () => ({Agent: createAgent}));
vi.mock('@newrelic/browser-agent/features/jserrors', () => ({JSErrors: class {}}));
vi.mock('@newrelic/browser-agent/features/page_view_event', () => ({PageViewEvent: class {}}));
vi.mock('@newrelic/browser-agent/features/page_view_timing', () => ({PageViewTiming: class {}}));

const config = (environment: 'dev' | 'prod'): RuntimeConfig => ({environment,
  identity: {mode: 'auth0', domain: 'jjt-snippet-searcher.us.auth0.com', clientId: 'public-client-id',
    audience: `https://jjt-snippets-${environment}.duckdns.org/api`}});
const page = {origin: 'https://jjt-snippets-prod.duckdns.org', pathname: '/', search: '', hash: ''};

describe('Browser environment isolation', () => {
  it('requires the exact HTTPS origin and matching runtime environment', () => {
    expect(browserEnvironment(config('prod'), page)).toBe('prod');
    expect(browserEnvironment(config('dev'), page)).toBeNull();
    expect(browserEnvironment(config('dev'), {...page, origin: 'https://jjt-snippets-dev.duckdns.org'})).toBe('dev');
    for (const origin of ['http://jjt-snippets-prod.duckdns.org', 'http://localhost:5173', 'https://other.example']) {
      expect(browserEnvironment(config('prod'), {...page, origin})).toBeNull();
    }
  });

  it('does not capture callbacks, queries, fragments or snippet identifiers', () => {
    for (const pathname of ['/auth/callback', '/snippets/private-id', '/unknown']) {
      expect(browserEnvironment(config('prod'), {...page, pathname})).toBeNull();
    }
    expect(browserEnvironment(config('prod'), {...page, search: '?code=private'})).toBeNull();
    expect(browserEnvironment(config('prod'), {...page, hash: '#private'})).toBeNull();
    expect(browserEnvironment({environment: 'prod', identity: {mode: 'disabled'}}, page)).toBeNull();
  });

  it('uses different public entities with the existing privacy restrictions', async () => {
    const {startNewRelicBrowser} = await import('./startNewRelicBrowser');
    startNewRelicBrowser('dev');
    startNewRelicBrowser('prod');
    const dev = createAgent.mock.calls.at(-2)![0];
    const prod = createAgent.mock.calls.at(-1)![0];
    expect(dev.info.applicationID).toBe('1103564597');
    expect(prod.info.applicationID).toBe('1103565589');
    expect(prod.loader_config.applicationID).toBe(prod.info.applicationID);
    expect(prod.init).toEqual(dev.init);
    expect(prod.init).toMatchObject({ajax: {enabled: false}, distributed_tracing: {enabled: false},
      privacy: {cookies_enabled: false}, session_replay: {enabled: false}, session_trace: {enabled: false}});
  });
});

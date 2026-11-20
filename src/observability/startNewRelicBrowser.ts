import {Agent} from '@newrelic/browser-agent/loaders/agent';
import {JSErrors} from '@newrelic/browser-agent/features/jserrors';
import {PageViewEvent} from '@newrelic/browser-agent/features/page_view_event';
import {PageViewTiming} from '@newrelic/browser-agent/features/page_view_timing';
import dev from './newRelicBrowserDev.json';
import prod from './newRelicBrowserProd.json';

export function startNewRelicBrowser(environment: 'dev' | 'prod') {
  const {info, loader_config} = environment === 'prod' ? prod : dev;

  new Agent({
    info,
    loader_config,
    features: [PageViewEvent, PageViewTiming, JSErrors],
    init: {
      ajax: {enabled: false},
      distributed_tracing: {enabled: false},
      privacy: {cookies_enabled: false},
      session_replay: {enabled: false},
      session_trace: {enabled: false},
    },
  });
}

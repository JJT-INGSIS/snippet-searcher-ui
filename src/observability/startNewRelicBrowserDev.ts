import {Agent} from '@newrelic/browser-agent/loaders/agent';
import {JSErrors} from '@newrelic/browser-agent/features/jserrors';
import {PageViewEvent} from '@newrelic/browser-agent/features/page_view_event';
import {PageViewTiming} from '@newrelic/browser-agent/features/page_view_timing';
import config from './newRelicBrowserDev.json';

export function startNewRelicBrowserDev() {
  const {info, loader_config} = config;

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

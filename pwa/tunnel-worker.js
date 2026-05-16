/**
 * EIRENE tunnel-worker.js
 * Service Worker — intercepts all fetch requests
 * Routes through Eirene proxy with JWT authentication
 * Ad/tracker blocking + JS tracker blocking + tracking parameter stripping
 *
 * Cloud SNS Pty Ltd
 */

const CACHE_NAME = 'eirene-v1';
const PROXY_URL  = 'https://eirene-proxy.elizahome.com/fetch';

// ── State ────────────────────────────────────────────────────────────────────
let jwtToken = null;

// ── Tracking Parameter Stripper ──────────────────────────────────────────────
const TRACKING_PARAMS = new Set([
  // Google
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'gclid', 'gclsrc', 'dclid', '_gl', '_ga',
  // Facebook/Meta
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
  // Microsoft
  'msclkid',
  // Mailchimp
  'mc_eid', 'mc_cid',
  // HubSpot
  '_hsenc', '_hsmi',
  // Marketo
  'mkt_tok',
  // Twitter/X
  'twclid',
  // LinkedIn
  'li_fat_id',
  // TikTok
  'ttclid',
  // Pinterest
  'epik',
  // Snapchat
  'ScCid',
  // Adobe
  's_cid', 'adobe_mc',
  // Amazon
  'tag', 'ascsubtag',
  // General
  'ref', 'igshid', 'zanpid', 'yclid', 'wickedid',
  'irclickid', 'impact_id', 'affiliate_id',
]);

function stripTrackingParams(url) {
  try {
    const u = new URL(url);
    let stripped = false;
    for (const param of TRACKING_PARAMS) {
      if (u.searchParams.has(param)) {
        u.searchParams.delete(param);
        stripped = true;
      }
    }
    if (stripped) {
      console.log('[tunnel-worker] Stripped tracking params from:', u.hostname);
    }
    return u.toString();
  } catch (e) {
    return url;
  }
}

// ── JS Tracker Script Patterns ────────────────────────────────────────────────
// Blocks tracking scripts even when served from first-party/CDN domains
const TRACKING_SCRIPT_PATTERNS = [
  // Google
  '/gtag/', '/gtag.js', '/gtm.js', '/analytics.js',
  '/google-analytics', '/ga.js', '/ga4',
  // Facebook
  '/fbevents.js', '/fbpixel', '/fb-pixel',
  // General patterns
  '/tracking', '/telemetry', '/fingerprint',
  '/beacon.min.js', '/beacon.js',
  '/pixel.gif', '/pixel.png', '/pixel.js',
  '/collect.js', '/event.js', '/ping.js',
  '/tr/', '/track/', '/tracker/',
  // Hotjar, FullStory etc
  '/hj.js', '/hjid', '/fs.js',
  // Clarity
  '/clarity.js',
  // Segment
  '/analytics.min.js',
];

function isTrackingScript(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return TRACKING_SCRIPT_PATTERNS.some(p => path.includes(p));
  } catch (e) {
    return false;
  }
}

// ── Ad/Tracker Domain Blocklist ──────────────────────────────────────────────
const BLOCKED_DOMAINS = new Set([
  // Cloudflare analytics (yes, even theirs)
  'static.cloudflareinsights.com', 'cloudflareinsights.com',
  // Google analytics & ads
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'googlesyndication.com', 'doubleclick.net', 'google-adservices.com',
  'adservice.google.com', 'googleadservices.com', 'stats.g.doubleclick.net',
  // Social tracking
  'facebook.com', 'connect.facebook.net', 'facebook.net',
  'analytics.twitter.com', 'ads.twitter.com', 't.co',
  'linkedin.com', 'snap.licdn.com', 'platform.linkedin.com',
  'analytics.tiktok.com', 'ads.tiktok.com',
  'ct.pinterest.com', 'log.pinterest.com',
  'tr.snapchat.com', 'sc-static.net',
  // Microsoft
  'clarity.ms', 'bat.bing.com', 'c.bing.com',
  'ads.microsoft.com', 'bingads.microsoft.com',
  // Apple
  'analytics.apple.com',
  // Yahoo/Oath
  'analytics.yahoo.com', 'sp.analytics.yahoo.com',
  'adtech.de', 'advertising.com', 'adtechus.com',
  // Adobe
  'omtrdc.net', 'adobedtm.com', 'demdex.net', '2o7.net',
  'adobedc.net', 'everesttech.net',
  // Amazon ads
  'amazon-adsystem.com', 'assoc-amazon.com', 'fls-na.amazon.com',
  // Ad networks
  'scorecardresearch.com', 'quantserve.com', 'quantcast.com',
  'outbrain.com', 'taboola.com', 'media.net',
  'criteo.com', 'criteo.net', 'adsafeprotected.com',
  'moatads.com', 'pubmatic.com', 'openx.net', 'rubiconproject.com',
  'appnexus.com', 'adnxs.com', 'smartadserver.com', 'sovrn.com',
  'lijit.com', 'contextweb.com', 'casalemedia.com', 'indexexchange.com',
  'yieldmanager.com', 'bidswitch.net', 'sharethrough.com', 'triplelift.com',
  '33across.com', 'rhythmone.com', 'yieldmo.com', 'undertone.com',
  'spotxchange.com', 'sonobi.com', 'adnuntius.com',
  // Fingerprinting & session recording
  'hotjar.com', 'mouseflow.com', 'fullstory.com', 'logrocket.com',
  'segment.com', 'segment.io', 'mixpanel.com', 'amplitude.com',
  'heap.io', 'heapanalytics.com', 'kissmetrics.com',
  'crazyegg.com', 'clicktale.net', 'inspectlet.com',
  // Marketing automation
  'intercom.io', 'intercom.com', 'intercomassets.com',
  'optimizely.com',
  'hubspot.com', 'hsforms.com', 'hs-scripts.com', 'hubapi.com',
  'marketo.com', 'mktoresp.com', 'munchkin.marketo.com',
  'pardot.com', 'pi.pardot.com',
  'klaviyo.com', 'mailchimp.com', 'list-manage.com',
  // A/B testing
  'cdn.optimizely.com', 'logx.optimizely.com',
  'abtasty.com', 'convertexperiments.com',
  // Analytics platforms
  'chartbeat.com', 'chartbeat.net',
  'newrelic.com', 'nr-data.net',
  'bugsnag.com', 'sentry.io',
  // Data brokers
  'bluekai.com', 'krxd.net', 'turn.com',
  'eyeota.net', 'exelate.com', 'nielsen.com',
  'acxiom.com', 'liveramp.com', 'rlcdn.com',
  'mathtag.com', 'adroll.com', 'perfectaudience.com',
  // Survey & feedback trackers
  'qualtrics.com', 'medallia.com', 'usabilla.com',
  // Chat widgets that track
  'zdassets.com', 'zendesk.com',
  'livechatinc.com', 'tawk.to',
  'drift.com', 'driftt.com',
  'crisp.chat', 'widget.intercom.io',
  // CDN-served trackers
  'tiqcdn.com', 'tvpixel.com', 'bazaarvoice.com',
  'trustpilot.com', 'yotpo.com',
  // Australia-specific
  'secure-au.imrworldwide.com',
]);

function isDomainBlocked(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// ── Noise Domains — bypass proxy, go direct ──────────────────────────────────
const NOISE_DOMAINS = new Set([
  'abc.net.au', 'bbc.com', 'smh.com.au', 'theaustralian.com.au',
  'bom.gov.au', 'weather.com', 'wikipedia.org', 'dictionary.com',
  'afl.com.au', 'nrl.com', 'foxsports.com.au', 'healthdirect.gov.au',
  'beyondblue.org.au', 'gumtree.com.au', 'ato.gov.au', 'mygov.com.au',
  'reddit.com', 'commbank.com.au', 'seek.com.au', 'realestate.com.au',
]);

function isNoiseDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const domain of NOISE_DOMAINS) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) return true;
    }
  } catch (e) {}
  return false;
}

// ── Eirene domains — never proxy ─────────────────────────────────────────────
function isEireneDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith('.elizahome.com') ||
           hostname === 'elizahome.com';
  } catch (e) {}
  return false;
}

// ── Install & Activate ───────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[tunnel-worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[tunnel-worker] Active. Controlling all clients.');
  event.waitUntil(clients.claim());
});

// ── Message Handler ──────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  const { type, token } = event.data || {};
  if (type === 'SET_TOKEN') {
    jwtToken = token;
    console.log('[tunnel-worker] JWT token received.');
  }
});

// ── Fetch Interceptor ────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const request = event.request;
  const url     = request.url;

  // Never intercept Eirene's own domains
  if (isEireneDomain(url)) return;

  // Never intercept noise traffic — goes direct
  if (isNoiseDomain(url)) return;

  // Block beacon API calls — silent 200
  if (request.destination === 'beacon') {
    event.respondWith(
      new Response('', { status: 200, statusText: 'Blocked by Eirene' })
    );
    return;
  }

  // Block tracker domains — silent 200
  if (isDomainBlocked(url)) {
    console.log('[tunnel-worker] Blocked domain:', new URL(url).hostname);
    event.respondWith(
      new Response('', { status: 200, statusText: 'Blocked by Eirene' })
    );
    return;
  }

  // Block tracking scripts by URL pattern — even from first-party domains
  if (isTrackingScript(url)) {
    console.log('[tunnel-worker] Blocked script:', url);
    event.respondWith(
      new Response('// Blocked by Eirene', {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
      })
    );
    return;
  }

  // No token yet — pass through (pre-auth)
  if (!jwtToken) return;

  // Route everything else through Eirene proxy
  event.respondWith(routeThroughProxy(request));
});

// ── Proxy Routing ─────────────────────────────────────────────────────────────
async function routeThroughProxy(request) {
  try {
    // Strip tracking parameters from URL
    const cleanUrl = stripTrackingParams(request.url);

    // Read body if needed
    let body = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    // Build clean headers — strip tracking, add auth
    const headers = new Headers();
    headers.set('X-Eirene-Auth',   `Bearer ${jwtToken}`);
    headers.set('X-Eirene-Target', cleanUrl);
    headers.set('X-Eirene-Method', request.method);

    // Forward safe original headers only
    const SAFE_HEADERS = [
      'accept', 'accept-language', 'content-type', 'content-length',
      'range', 'if-modified-since', 'if-none-match', 'cache-control',
    ];
    for (const h of SAFE_HEADERS) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }

    // POST to proxy /fetch endpoint
    const proxyResponse = await fetch(PROXY_URL, {
      method:      'POST',
      headers:     headers,
      body:        body || null,
      mode:        'cors',
      credentials: 'omit',
    });

    return proxyResponse;

  } catch (e) {
    console.error('[tunnel-worker] Proxy error:', e);
    return new Response('Eirene proxy error', { status: 502 });
  }
}

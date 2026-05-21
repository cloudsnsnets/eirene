/**
 * EIRENE tunnel-worker.js
 * Service Worker — intercepts all fetch requests
 * Routes through Eirene proxy with JWT authentication
 * Ad/tracker blocking + JS tracker blocking + tracking parameter stripping
 * WebRTC STUN/TURN blocking
 * Session isolation — token cleared, cache wiped, session ID rotated on end
 *
 * Cloud SNS Pty Ltd
 */

const CACHE_NAME     = 'eirene-v1';
const PROXY_BASE      = 'https://eirene.elizahome.com';
const HOPPER_SSE_URL  = 'https://eirene.elizahome.com/sse';
const HOPPER_PATH_URL = 'https://eirene.elizahome.com/current-path';

// Current proxy path — updated by SSE from tunnel hopper
// Persisted in SW cache — survives phone off, app close, reboot
// Path is the Cloudflare route prefix e.g. /push/r2/sync/
// Full fetch URL = PROXY_BASE + proxyPath + 'fetch'
let proxyPath = '/';   // default — overwritten on first SSE connect

// -- State --------------------------------------------------------------------
let jwtToken  = null;
let sessionId = crypto.randomUUID();   // Rotates on every new auth + every session end
let torMode   = false;                 // Set by SET_TOR_MODE message from page

// -- Tracking Parameter Stripper ----------------------------------------------
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
  'gclid', 'gclsrc', 'dclid', '_gl', '_ga',
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
  'msclkid', 'mc_eid', 'mc_cid', '_hsenc', '_hsmi', 'mkt_tok',
  'twclid', 'li_fat_id', 'ttclid', 'epik', 'ScCid', 's_cid', 'adobe_mc',
  'tag', 'ascsubtag', 'ref', 'igshid', 'zanpid', 'yclid', 'wickedid',
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
    if (stripped) console.log('[tunnel-worker] Stripped tracking params from:', u.hostname);
    return u.toString();
  } catch (e) {
    return url;
  }
}

// -- JS Tracker Script Patterns -----------------------------------------------
const TRACKING_SCRIPT_PATTERNS = [
  '/gtag/', '/gtag.js', '/gtm.js', '/analytics.js', '/google-analytics', '/ga.js', '/ga4',
  '/fbevents.js', '/fbpixel', '/fb-pixel',
  '/tracking', '/telemetry', '/fingerprint',
  '/beacon.min.js', '/beacon.js', '/pixel.gif', '/pixel.png', '/pixel.js',
  '/collect.js', '/event.js', '/ping.js', '/tr/', '/track/', '/tracker/',
  '/hj.js', '/hjid', '/fs.js', '/clarity.js', '/analytics.min.js',
];

function isTrackingScript(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return TRACKING_SCRIPT_PATTERNS.some(p => path.includes(p));
  } catch (e) {
    return false;
  }
}

// -- WebRTC STUN/TURN Blocklist -----------------------------------------------
const STUN_TURN_DOMAINS = new Set([
  'stun.l.google.com', 'stun1.l.google.com', 'stun2.l.google.com',
  'stun3.l.google.com', 'stun4.l.google.com',
  'stun.services.mozilla.com', 'stun.mozilla.com',
  'stun.cloudflare.com', 'stun.twilio.com', 'global.stun.twilio.com',
  'stun.ekiga.net', 'stun.ideasip.com', 'stunserver.org',
  'turn.l.google.com', 'turn.twilio.com', 'global.turn.twilio.com',
]);

function isStunTurnEndpoint(url) {
  try {
    const hostname = new URL(url).hostname;
    if (STUN_TURN_DOMAINS.has(hostname)) return true;
    if (/^stun[0-9]*\./.test(hostname)) return true;
    if (/^turn[0-9]*\./.test(hostname)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

// -- Ad/Tracker Domain Blocklist ----------------------------------------------
const BLOCKED_DOMAINS = new Set([
  'static.cloudflareinsights.com', 'cloudflareinsights.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'googlesyndication.com', 'doubleclick.net', 'google-adservices.com',
  'adservice.google.com', 'googleadservices.com', 'stats.g.doubleclick.net',
  'facebook.com', 'connect.facebook.net', 'facebook.net',
  'analytics.twitter.com', 'ads.twitter.com', 't.co',
  'linkedin.com', 'snap.licdn.com', 'platform.linkedin.com',
  'analytics.tiktok.com', 'ads.tiktok.com',
  'ct.pinterest.com', 'log.pinterest.com', 'tr.snapchat.com', 'sc-static.net',
  'clarity.ms', 'bat.bing.com', 'c.bing.com', 'ads.microsoft.com', 'bingads.microsoft.com',
  'analytics.apple.com',
  'analytics.yahoo.com', 'sp.analytics.yahoo.com', 'adtech.de', 'advertising.com', 'adtechus.com',
  'omtrdc.net', 'adobedtm.com', 'demdex.net', '2o7.net', 'adobedc.net', 'everesttech.net',
  'amazon-adsystem.com', 'assoc-amazon.com', 'fls-na.amazon.com',
  'scorecardresearch.com', 'quantserve.com', 'quantcast.com',
  'outbrain.com', 'taboola.com', 'media.net',
  'criteo.com', 'criteo.net', 'adsafeprotected.com', 'moatads.com',
  'pubmatic.com', 'openx.net', 'rubiconproject.com',
  'appnexus.com', 'adnxs.com', 'smartadserver.com', 'sovrn.com',
  'lijit.com', 'contextweb.com', 'casalemedia.com', 'indexexchange.com',
  'yieldmanager.com', 'bidswitch.net', 'sharethrough.com', 'triplelift.com',
  '33across.com', 'rhythmone.com', 'yieldmo.com', 'undertone.com',
  'spotxchange.com', 'sonobi.com', 'adnuntius.com',
  'hotjar.com', 'mouseflow.com', 'fullstory.com', 'logrocket.com',
  'segment.com', 'segment.io', 'mixpanel.com', 'amplitude.com',
  'heap.io', 'heapanalytics.com', 'kissmetrics.com', 'crazyegg.com', 'clicktale.net', 'inspectlet.com',
  'intercom.io', 'intercom.com', 'intercomassets.com', 'optimizely.com',
  'hubspot.com', 'hsforms.com', 'hs-scripts.com', 'hubapi.com',
  'marketo.com', 'mktoresp.com', 'munchkin.marketo.com', 'pardot.com', 'pi.pardot.com',
  'klaviyo.com', 'mailchimp.com', 'list-manage.com',
  'cdn.optimizely.com', 'logx.optimizely.com', 'abtasty.com', 'convertexperiments.com',
  'chartbeat.com', 'chartbeat.net', 'newrelic.com', 'nr-data.net', 'bugsnag.com', 'sentry.io',
  'bluekai.com', 'krxd.net', 'turn.com', 'eyeota.net', 'exelate.com', 'nielsen.com',
  'acxiom.com', 'liveramp.com', 'rlcdn.com', 'mathtag.com', 'adroll.com', 'perfectaudience.com',
  'qualtrics.com', 'medallia.com', 'usabilla.com',
  'zdassets.com', 'zendesk.com', 'livechatinc.com', 'tawk.to',
  'drift.com', 'driftt.com', 'crisp.chat', 'widget.intercom.io',
  'tiqcdn.com', 'tvpixel.com', 'bazaarvoice.com', 'trustpilot.com', 'yotpo.com',
  'secure-au.imrworldwide.com',
]);

function isDomainBlocked(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) return true;
    }
  } catch (e) {}
  return false;
}

// -- Eirene domains — never proxy ---------------------------------------------
function isEireneDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith('.elizahome.com') || hostname === 'elizahome.com';
  } catch (e) {}
  return false;
}

// -- Session Management -------------------------------------------------------
async function endSession() {
  jwtToken  = null;
  sessionId = crypto.randomUUID();   // Old session ID is dead — rotate immediately

  // Wipe all SW caches — no state persists between sessions
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    console.log('[tunnel-worker] Session ended. Token cleared. Caches wiped. ID rotated.');
  } catch (e) {
    console.log('[tunnel-worker] Session ended. Token cleared. ID rotated.');
  }

  // Notify all open clients — UI resets to idle
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  allClients.forEach(client => client.postMessage({ type: 'SESSION_ENDED' }));
}

// -- Tunnel Hopper SSE Integration -------------------------------------------
// EventSource is not available in SW scope — use fetch + ReadableStream instead

async function loadPersistedPath() {
  try {
    const cache    = await caches.open(CACHE_NAME);
    const response = await cache.match('/__eirene_proxy_path__');
    if (response) {
      proxyPath = await response.text();
      console.log('[tunnel-worker] Loaded persisted proxy path:', proxyPath);
    } else {
      // Fetch current path from hopper on first run
      const resp = await fetch(HOPPER_PATH_URL);
      const data = await resp.json();
      if (data.path) {
        proxyPath = data.path;
        console.log('[tunnel-worker] Fetched current proxy path:', proxyPath);
      }
    }
  } catch (e) {
    console.log('[tunnel-worker] Using default proxy path:', proxyPath);
  }
}

async function persistPath(path) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put('/__eirene_proxy_path__',
      new Response(path, { status: 200 })
    );
  } catch (e) {}
}

async function connectToHopper() {
  // SW-compatible SSE via fetch + ReadableStream
  // EventSource is a Window API — not available in Service Worker scope
  try {
    const response = await fetch(HOPPER_SSE_URL, {
      headers: { 'Accept': 'text/event-stream' },
      credentials: 'omit',
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE connect failed: ${response.status}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('
');
      buffer = lines.pop();  // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.type === 'PATH_ROTATION' || data.type === 'PATH_CURRENT') {
            proxyPath = data.path;
            await persistPath(proxyPath);
            console.log('[tunnel-worker] Proxy path updated:', proxyPath);
            // Notify all clients
            const allClients = await clients.matchAll({ includeUncontrolled: true });
            allClients.forEach(c => c.postMessage({
              type: 'TUNNEL_URL_UPDATED',
              url:  `${PROXY_BASE}${proxyPath}`
            }));
          }
        } catch (e) {
          // Non-JSON line — skip
        }
      }
    }
  } catch (e) {
    console.log('[tunnel-worker] SSE disconnected — reconnecting in 30s:', e.message);
    setTimeout(connectToHopper, 30000);
  }
}

// -- Install & Activate -------------------------------------------------------
self.addEventListener('install', event => {
  console.log('[tunnel-worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[tunnel-worker] Active. Controlling all clients.');
  event.waitUntil(
    clients.claim().then(() => {
      // Load persisted proxy path then connect to hopper SSE
      return loadPersistedPath().then(() => connectToHopper());
    })
  );
});

// -- Message Handler ----------------------------------------------------------
self.addEventListener('message', event => {
  const { type, token } = event.data || {};

  if (type === 'SET_TOKEN') {
    jwtToken  = token;
    sessionId = crypto.randomUUID();   // New auth = new session ID
    console.log('[tunnel-worker] JWT received. Session ID rotated.');
  }

  if (type === 'SESSION_END') {
    event.waitUntil(endSession());
  }

  if (type === 'COUNT_CLIENTS') {
    event.waitUntil(
      clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(all => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ count: all.length });
        }
      })
    );
  }

  if (type === 'SET_TOR_MODE') {
    torMode = event.data.enabled;
    console.log(`[tunnel-worker] Tor mode: ${torMode ? 'ON' : 'OFF'}`);
  }
});

// -- Fetch Interceptor --------------------------------------------------------
self.addEventListener('fetch', event => {
  const request = event.request;
  const url     = request.url;

  if (isEireneDomain(url)) return;
  if (request.destination === 'beacon') {
    event.respondWith(new Response('', { status: 200, statusText: 'Blocked by Eirene' }));
    return;
  }

  if (isStunTurnEndpoint(url)) {
    console.log('[tunnel-worker] Blocked STUN/TURN:', new URL(url).hostname);
    event.respondWith(new Response('', { status: 200, statusText: 'Blocked by Eirene' }));
    return;
  }

  if (isDomainBlocked(url)) {
    console.log('[tunnel-worker] Blocked domain:', new URL(url).hostname);
    event.respondWith(new Response('', { status: 200, statusText: 'Blocked by Eirene' }));
    return;
  }

  if (isTrackingScript(url)) {
    console.log('[tunnel-worker] Blocked script:', url);
    event.respondWith(new Response('// Blocked by Eirene', {
      status: 200,
      headers: { 'Content-Type': 'application/javascript' }
    }));
    return;
  }

  if (!jwtToken) return;

  // In Tor mode — block audio and video requests at SW level
  // Belt-and-suspenders with proxy-level blocking
  if (torMode) {
    const accept = request.headers.get('accept') || '';
    const url_lower = url.toLowerCase();
    if (
      accept.includes('audio/') ||
      accept.includes('video/') ||
      url_lower.match(/\.(mp3|mp4|ogg|wav|webm|avi|mkv|flac|aac|m4a|m4v|mov)([?#]|$)/)
    ) {
      console.log('[tunnel-worker] Tor mode: blocked media request:', url);
      event.respondWith(
        new Response('Media blocked in Tor mode', { status: 403 })
      );
      return;
    }
  }

  event.respondWith(routeThroughProxy(request));
});

// -- Proxy Routing ------------------------------------------------------------
async function routeThroughProxy(request) {
  try {
    const cleanUrl = stripTrackingParams(request.url);

    let body = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    const headers = new Headers();
    headers.set('X-Eirene-Auth',    `Bearer ${jwtToken}`);
    headers.set('X-Eirene-Target',  cleanUrl);
    headers.set('X-Eirene-Method',  request.method);
    headers.set('X-Eirene-Session', sessionId);   // Internal — proxy strips before forwarding
    if (torMode) {
      headers.set('X-Eirene-Tor', 'true');           // Internal — proxy strips before forwarding
    }

    const SAFE_HEADERS = [
      'accept', 'accept-language', 'content-type', 'content-length',
      'range', 'if-modified-since', 'if-none-match', 'cache-control',
    ];
    for (const h of SAFE_HEADERS) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }

    const proxyResponse = await fetch(`${PROXY_BASE}${proxyPath}fetch`, {
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

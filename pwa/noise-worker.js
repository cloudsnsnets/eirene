/**
 * EIRENE noise-worker.js
 * Web Worker — generates cover traffic
 * Runs independently of real traffic
 * Goes DIRECT to internet — NOT through tunnel
 * Poisson-distributed timing. Human-like.
 *
 * POC version — 20 URLs. Full list (~500) in production.
 *
 * Cloud SNS Pty Ltd
 */

// ── URL List (POC — minimal) ─────────────────────────────────────────────────
const NOISE_URLS = [
  // News
  'https://www.abc.net.au/',
  'https://www.bbc.com/news',
  'https://www.smh.com.au/',
  'https://www.theaustralian.com.au/',

  // Weather
  'https://www.bom.gov.au/',
  'https://www.weather.com/',

  // Reference
  'https://en.wikipedia.org/wiki/Main_Page',
  'https://www.dictionary.com/',

  // Sport
  'https://www.afl.com.au/',
  'https://www.nrl.com/',
  'https://www.foxsports.com.au/',

  // Health
  'https://www.healthdirect.gov.au/',
  'https://www.beyondblue.org.au/',

  // Shopping
  'https://www.gumtree.com.au/',

  // Government
  'https://www.ato.gov.au/',
  'https://www.mygov.com.au/',

  // General
  'https://www.reddit.com/r/australia/',
  'https://www.commbank.com.au/',
  'https://www.seek.com.au/',
  'https://www.realestate.com.au/',
];

// ── Timing (Poisson-distributed) ─────────────────────────────────────────────
const TIME_OF_DAY_FACTOR = {
  // hour: factor
   6: 1.2,  7: 1.2,  8: 1.2,    // morning scroll
   9: 0.6, 10: 0.6, 11: 0.6,   // at work
  12: 0.8, 13: 0.8,             // lunch
  14: 0.6, 15: 0.6, 16: 0.6,   // afternoon
  17: 1.5, 18: 1.5, 19: 1.5,   // evening peak
  20: 1.5, 21: 1.3, 22: 0.8,   // winding down
  23: 0.3,  0: 0.3,  1: 0.3,   // sleep
   2: 0.3,  3: 0.3,  4: 0.3,   // sleep
   5: 0.5,                      // early morning
};

const BASE_INTERVAL_MS = 60000;  // 60 seconds base

function poissonInterval() {
  const hour   = new Date().getHours();
  const factor = TIME_OF_DAY_FACTOR[hour] ?? 0.6;
  // Exponential distribution: -ln(U) / λ
  const lambda = factor;
  const sample = -Math.log(Math.random()) / lambda;
  // Clamp to 15s – 120s
  return Math.max(15000, Math.min(120000, sample * BASE_INTERVAL_MS));
}

// ── Request size variety ──────────────────────────────────────────────────────
// 70% small (HEAD/GET minimal), 20% medium, 10% larger
function pickMethod() {
  const r = Math.random();
  if (r < 0.7) return 'HEAD';   // Smallest — just headers
  return 'GET';                  // Full fetch
}

// ── Noise fetch ───────────────────────────────────────────────────────────────
async function makeNoise() {
  const url    = NOISE_URLS[Math.floor(Math.random() * NOISE_URLS.length)];
  const method = pickMethod();

  try {
    await fetch(url, {
      method:      method,
      mode:        'no-cors',     // Cross-origin, no CORS required
      credentials: 'omit',
      cache:       'no-store',
      headers: {
        'Accept':          'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-AU,en;q=0.9',
      }
    });
    // Deliberately ignore response — we don't care about content
  } catch (e) {
    // Silent — noise failures are expected and irrelevant
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function noiseLoop() {
  while (true) {
    const interval = poissonInterval();
    await new Promise(resolve => setTimeout(resolve, interval));
    await makeNoise();
  }
}

// Start immediately
console.log('[noise-worker] Cover traffic started.');
noiseLoop();

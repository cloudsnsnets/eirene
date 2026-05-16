# Eirene
## Private Tunnel. Your Voice. Your Rules.

Free. Forever. Open source frontend.

Eirene routes your mobile traffic through your own home server, authenticated by your voice, with built-in noise generation to defeat traffic analysis and an aggressive ad and tracker blocker.

No company in the middle. No logs. No tracking. No cloud.  
Your server. Your voice. Your data.

---

## What it does

- **Voice authentication** — your voice is the key, stored locally on your home server
- **Encrypted tunnel** — all traffic through Cloudflare, your home IP hidden
- **Cover traffic** — Poisson-distributed noise defeats traffic analysis
- **Ad and tracker blocking** — 100+ tracker domains silently dropped
- **Tracking parameter stripping** — UTM, fbclid, gclid and 40+ others removed from URLs
- **PHI stripping** — phone numbers, names, GPS coordinates removed before forwarding
- **Path hopping** — tunnel path rotates every 20–90 minutes

## What it doesn't do

- It is not a VPN service — there is no Eirene server
- It does not make you anonymous — your home ISP sees Cloudflare traffic
- It does not protect against nation-state actors — use Tor + Tails for that
- It does not work if your home box is offline

Eirene protects you from employer network monitoring and commercial data harvesting. For journalists or activists in high-risk situations — use Tor + Tails OS on a dedicated device.

---

## Requirements

- A machine that can run Docker 24/7:
  - Raspberry Pi 4 (4GB+) or Pi 5 — recommended (~$150–300 AUD)
  - Any spare laptop or NUC — works fine
  - Any PC that can stay on — works fine
- Home internet connection
- Free Cloudflare account
- A domain name

---

## Setup (~10 minutes)

### 1. Install Docker

**Ubuntu/Debian/Raspberry Pi OS:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
```

**Windows (WSL2):**  
Install Docker Desktop from https://docs.docker.com/desktop/windows/

### 2. Clone and run the setup wizard

```bash
git clone https://github.com/cloudsnsnets/eirene
cd eirene
./eirene-setup.sh
```

The wizard will:
- Authenticate with GitHub Container Registry to pull backend images
- Generate a secure JWT secret
- Ask for your Cloudflare tunnel token
- Configure your domains
- Start all services
- Guide you through voice enrollment on your phone

### 3. Open on your phone

Visit your Eirene URL on your phone browser.  
Tap `setup` at the bottom to enroll your voice (3 recordings).  
Then tap the microphone to authenticate.  
Add to home screen.

Done. It's your app now.

---

## Architecture

```
Your phone (PWA)
    ↓
Cloudflare Tunnel (HTTPS, your domain, path-hopping)
    ↓
Your home box
    ├── Voice Auth  — WeSpeaker ONNX, local, no cloud
    ├── Proxy       — PHI stripping, JWT validation, /fetch endpoint
    ├── PWA server  — Nginx serving the open source frontend
    └── Tunnel Hopper — Cloudflare path rotation via API
    ↓
The real internet
```

---

## Open source model

The trust-critical code that runs on your device is open source. Audit it yourself.

| File | What it does |
|------|-------------|
| `pwa/tunnel-worker.js` | Service Worker — intercepts fetch, blocks trackers, routes through proxy |
| `pwa/noise-worker.js` | Web Worker — generates Poisson-distributed cover traffic |
| `pwa/index.html` | PWA UI — voice auth flow, enroll flow, status indicators |
| `pwa/nginx.conf` | Nginx config — serves PWA, proxies voice-auth API calls |
| `docker-compose.yml` | Full stack orchestration |
| `eirene-setup.sh` | Setup wizard |

The backend services (proxy, voice auth, tunnel hopper) are proprietary Cloud SNS IP, shipped as pre-built multi-platform Docker images for `linux/amd64` and `linux/arm64`.

---

## Threat model

**Protected against:**
- Employer and site network monitoring (traffic analysis, content inspection)
- ISP logging at the remote site
- Ad network tracking and behavioural profiling
- Traffic correlation (noise engine + path hopping)
- PHI leakage in AI queries

**Not protected against:**
- Your home ISP (they see you connecting to Cloudflare)
- Physical device seizure
- Nation-state actors with broad network access
- Voice cloning attacks (mitigated by passphrase secrecy)

---

## Hardware recommendation

**Raspberry Pi 5 (8GB) + M.2 NVMe SSD**  
~$300 AUD. Draws 5–8W. Costs ~$1/month in electricity.  
Runs forever. Serves one person perfectly.

---

## Licence

Frontend code (tunnel-worker.js, noise-worker.js, index.html, nginx.conf, eirene-setup.sh) is licensed under GPL-3.0.  
Backend Docker images are proprietary — © Cloud SNS Pty Ltd.

---

*Cloud SNS Pty Ltd*  
*For Amal. For Eliza. For Those Who Need Us at 3 AM.*

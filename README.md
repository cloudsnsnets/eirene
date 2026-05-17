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

**A machine to be your home server:**
- Raspberry Pi 4 (4GB+) or Pi 5 — recommended (~$150–300 AUD)
- Any spare laptop, NUC, or PC that can stay on
- Must be able to run Docker

**A Cloudflare account with a domain:**
- Free Cloudflare account at cloudflare.com
- A domain registered at Cloudflare Registrar (~$10 AUD/year)
- This is the only cost — less than one month of any VPN service

**That's it.** The setup wizard handles everything else automatically.

---

## Setup (~15 minutes)

### 1. Install Docker

**Ubuntu/Debian/Raspberry Pi OS:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in
```

**Windows (WSL2):**
Install Docker Desktop from https://docs.docker.com/desktop/windows/

### 2. Create a Cloudflare account and domain

1. Sign up free at **https://cloudflare.com**
2. Go to **Domains → Buy domain** — search for something simple (~$10/year)
3. Purchase the domain — standard checkout, no hidden fees

### 3. Create a Cloudflare API token

1. Go to **https://dash.cloudflare.com/profile/api-tokens**
2. Click **Create Token** → use **"Edit zone DNS"** template
3. Add one more permission: **Account → Cloudflare Tunnel → Edit**
4. Click **Create Token** → copy it immediately

### 4. Clone and run the setup wizard

```bash
git clone https://github.com/cloudsnsnets/eirene
cd eirene
./eirene-setup.sh
```

The wizard will:
- Verify your Cloudflare API token
- Create your tunnel automatically
- Set up DNS records automatically
- Configure tunnel routes automatically
- Generate a secure JWT secret
- Pull all Docker images
- Start all services

**No manual Cloudflare dashboard steps required.**

### 5. Enroll your voice

Visit your domain on your phone browser.  
Tap **setup** at the bottom of the screen.  
Record your passphrase 3 times.  
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
    ├── Proxy       — PHI stripping, JWT validation
    ├── PWA server  — Nginx serving the open source frontend
    └── Tunnel Hopper — path rotation via Cloudflare API
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
- Employer and site network monitoring
- ISP logging at the remote site
- Ad network tracking and behavioural profiling
- Traffic correlation (noise engine + path hopping)
- PHI leakage in AI queries

**Not protected against:**
- Your home ISP (they see you connecting to Cloudflare)
- Physical device seizure
- Nation-state actors
- Voice cloning (mitigated by passphrase secrecy)

---

## Hardware recommendation

**Raspberry Pi 5 (8GB) + M.2 NVMe SSD**  
~$300 AUD. Draws 5–8W. Costs ~$1/month in electricity.  
Runs forever. Serves one person perfectly.

---

## Licence

Frontend code is licensed under GPL-3.0.  
Backend Docker images are proprietary — © Cloud SNS Pty Ltd.

---

*Cloud SNS Pty Ltd*  
*For Amal. For Eliza. For Those Who Need Us at 3 AM.*

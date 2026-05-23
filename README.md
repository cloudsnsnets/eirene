# Eirene
## Private Browsing. Ad-Free. Your Voice.

Free. Forever. Open source.

Eirene is a private browser that runs on hardware you already own.
No company in the middle. No logs. No tracking. No cloud subscription.
Your server. Your voice. Your family. Your rules.

---

## The idea

Browse normally in Chrome, Edge, or Firefox.
When you need privacy — open a new tab.
Go to your Eirene address. Speak your passphrase.
Browse. Ad-free. Tracker-free.
Want more? Tap 🧅 for Tor mode.
Done? Tap LOCK. Or just close the tab.

No warnings. No restrictions. No paranoia.
Just a clean room you walk into when you need one.

---

## What it does

- **Voice authentication** — your voice is the key, stored locally on your server
- **Multi-user** — family accounts with roles (admin, family, kids)
- **Parental controls** — kids accounts block adult content, Tor, and LAN access
- **OTP enrollment** — add family members with a 6-digit one-time PIN
- **Sore throat fallback** — household PIN if voice fails, 1-hour session
- **Encrypted tunnel** — all traffic through Cloudflare, your home IP hidden
- **Ad and tracker blocking** — 100+ tracker domains silently dropped
- **Tracking parameter stripping** — UTM, fbclid, gclid and 40+ others removed
- **Anti-fingerprinting** — 78+ browser APIs spoofed, CreepJS defeated
- **Cover traffic** — Poisson-distributed noise defeats traffic analysis
- **Tor mode** — one tap, purple ring, real Tor exit IP (admin only)
- **LAN management** — access your router, NAS, Home Assistant from anywhere
- **PHI stripping** — phone numbers, names, GPS coordinates removed before forwarding
- **Path hopping** — tunnel path rotates every 20-90 minutes

---

## The family

```
Admin   — full access, manages the family, generates OTP for new users
Family  — internet + LAN access, no Tor
Kids    — internet only, restricted content, no LAN, no Tor
```

Voice identifies users automatically — no username field.
Eirene hears who you are.

---

## LAN management

Eirene runs on your home network. Which means it can reach everything on it.

Open Eirene from anywhere in the world.
Browse to your NAS, your router, your Home Assistant.
Private. Voice authenticated. No VPN. No port forwarding.

---

## What it doesn't do

- It is not a VPN service — there is no Eirene server
- It does not make you anonymous — your home ISP sees Cloudflare traffic
- It does not protect against nation-state actors — use Tor + Tails for that
- It does not work if your home server is offline

Eirene protects you from employer network monitoring and commercial data
harvesting. For journalists or activists in high-risk situations — use
Tor + Tails OS on a dedicated device.

---

## Install

**Windows:**
1. Download [EireneSetup.exe](https://eirene.run.place)
2. Double-click and follow the prompts

**Linux / Mac / Pi:**
```bash
curl -sSL https://eirene.run.place/setup -o setup.sh && bash setup.sh
```

Requires: a Cloudflare account + domain (~$10/year). Everything else is free.

---

## First time setup

1. Open your Eirene URL in any browser
2. Tap **setup** at the bottom of the screen
3. Enter your nickname + the setup secret shown at the end of install
4. Record your passphrase 3 times
5. Speak your passphrase to log in

**Add family members:**
1. Log in as admin
2. Tap ⚙️ in the top bar
3. Enter nickname + role, tap **Generate OTP**
4. Share the 6-digit PIN — they tap setup, enter nickname + PIN, enroll

---

## Architecture

```
Browser → Cloudflare Tunnel → nginx → aiohttp proxy
                                    → voice-auth
                                    → DNSCrypt (DoH)
                                    → Tor (optional)
```

Seven Docker containers. Runs on a $60 Raspberry Pi 4.
Memory usage: ~115MB total.

---

## Platform support

| Platform | Method | Status |
|----------|--------|--------|
| Windows 10/11 | EireneSetup.exe | ✅ |
| Linux / Mac | curl \| bash | ✅ |
| Raspberry Pi 4/5 | curl \| bash | ✅ |

---

## Versions

| Tag | Milestone |
|-----|-----------|
| v2.3.0 | Multi-user, family roles, OTP enrollment, LAN proxy |
| v2.1.0 | EireneSetup.exe, no Docker Desktop |
| v2.0.1 | 11 bug fixes, multi-arch ARM64 |
| v2.0.0 | iframe browser, full web browsing |
| v1.0.0 | Initial release |

---

## License

Open source. Free forever.
No premium tier. No advertising. No selling your data — we don't have your data.

Privacy shouldn't be a luxury.

---

*Cloud SNS Pty Ltd — εἰρήνη*
*For Amal. For Eliza. For those who need us at 3 AM.*

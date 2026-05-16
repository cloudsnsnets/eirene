#!/bin/bash
# ═══════════════════════════════════════════════════════════
# EIRENE Setup Wizard
# Cloud SNS Pty Ltd
# Free. Forever. Your tunnel. Your voice. Your rules.
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  ███████╗██╗██████╗ ███████╗███╗   ██╗███████╗${NC}"
echo -e "${CYAN}  ██╔════╝██║██╔══██╗██╔════╝████╗  ██║██╔════╝${NC}"
echo -e "${CYAN}  █████╗  ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ${NC}"
echo -e "${CYAN}  ██╔══╝  ██║██╔══██╗██╔══╝  ██║╚██╗██║██╔══╝  ${NC}"
echo -e "${CYAN}  ███████╗██║██║  ██║███████╗██║ ╚████║███████╗${NC}"
echo -e "${CYAN}  ╚══════╝╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚══════╝${NC}"
echo ""
echo -e "  ${YELLOW}Your tunnel. Your voice. Your rules.${NC}"
echo ""

# ── 1. Check Docker ──────────────────────────────────────────────────────────
echo -e "${CYAN}[1/6] Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found.${NC}"
    echo "  Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found.${NC}"
    echo "  Install Docker Compose plugin."
    exit 1
fi
echo -e "${GREEN}✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"
echo -e "${GREEN}✓ Docker Compose $(docker compose version --short)${NC}"

# ── 2. GitHub Container Registry login ───────────────────────────────────────
echo ""
echo -e "${CYAN}[2/6] GitHub Container Registry...${NC}"
echo ""
echo "  Eirene backend images are hosted on GitHub Container Registry."
echo "  You need a GitHub Personal Access Token with read:packages scope."
echo ""
echo "  Create one at: https://github.com/settings/tokens"
echo "  Scope needed: read:packages"
echo ""
read -p "  Paste your GitHub token: " GHCR_TOKEN
echo ""

if [ -z "$GHCR_TOKEN" ]; then
    echo -e "${RED}✗ No token provided. Exiting.${NC}"
    exit 1
fi

echo "$GHCR_TOKEN" | docker login ghcr.io \
    -u cloudsnsnets \
    --password-stdin 2>/dev/null

echo -e "${GREEN}✓ Logged in to GitHub Container Registry${NC}"

# ── 3. Create .env ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/6] Configuring environment...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env
fi

# Generate JWT secret if not set
if grep -q "change-me" .env; then
    SECRET=$(openssl rand -hex 32)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$SECRET/" .env
    echo -e "${GREEN}✓ JWT secret generated${NC}"
else
    echo -e "${GREEN}✓ JWT secret already set${NC}"
fi

# Save GHCR token
sed -i "s|GHCR_TOKEN=.*|GHCR_TOKEN=$GHCR_TOKEN|" .env

# ── 4. Cloudflare tunnel token ───────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/6] Cloudflare tunnel setup...${NC}"
echo ""
echo "  You need a free Cloudflare account and a tunnel token."
echo ""
echo "  Steps:"
echo "  1. Go to https://one.dash.cloudflare.com/"
echo "  2. Zero Trust → Networks → Tunnels → Create tunnel"
echo "  3. Name it anything (e.g. 'eirene-home')"
echo "  4. Copy the tunnel token shown"
echo ""
read -p "  Paste your Cloudflare tunnel token: " CF_TOKEN
echo ""

if [ -z "$CF_TOKEN" ]; then
    echo -e "${RED}✗ No token provided. Exiting.${NC}"
    exit 1
fi

sed -i "s|CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$CF_TOKEN|" .env
echo -e "${GREEN}✓ Cloudflare token saved${NC}"

# ── 5. Domain ────────────────────────────────────────────────────────────────
echo ""
read -p "  Your Eirene PWA domain (e.g. eirene.yourdomain.com): " DOMAIN
read -p "  Your Eirene proxy domain (e.g. eirene-proxy.yourdomain.com): " PROXY_DOMAIN

if [ -z "$DOMAIN" ] || [ -z "$PROXY_DOMAIN" ]; then
    echo -e "${RED}✗ Both domains required. Exiting.${NC}"
    exit 1
fi

sed -i "s|DOMAIN=.*|DOMAIN=$DOMAIN|" .env
echo -e "${GREEN}✓ Domains configured${NC}"
echo ""
echo -e "${YELLOW}  ⚠ In your Cloudflare tunnel settings, add two public hostnames:${NC}"
echo "    $DOMAIN       → http://eirene-pwa:8082"
echo "    $PROXY_DOMAIN → http://eirene-proxy:8080"
echo ""
read -p "  Press Enter when Cloudflare routes are configured..."

# ── 6. Start Eirene ──────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[5/6] Pulling images and starting Eirene...${NC}"
docker compose pull
docker compose up -d

# Wait for voice-auth healthcheck
echo ""
echo -e "  Waiting for voice auth service..."
ATTEMPTS=0
until docker exec eirene-voice-auth \
    python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8081/health')" \
    2>/dev/null; do
    sleep 3
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -gt 20 ]; then
        echo -e "${RED}✗ Voice auth failed to start.${NC}"
        echo "  Check: docker logs eirene-voice-auth"
        exit 1
    fi
done

echo -e "${GREEN}✓ All services running${NC}"

# ── 7. Voice enrollment ──────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[6/6] Voice enrollment...${NC}"
echo ""
echo -e "  ${GREEN}Eirene is running!${NC}"
echo ""
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║                                           ║"
echo "  ║  Open this URL on your phone:             ║"
echo "  ║                                           ║"
echo -e "  ║  ${CYAN}https://$DOMAIN${NC}"
echo "  ║                                           ║"
echo "  ║  Tap 'setup' at the bottom of the screen  ║"
echo "  ║  Record your passphrase 3 times           ║"
echo "  ║  Then tap the microphone to authenticate  ║"
echo "  ║                                           ║"
echo "  ╚═══════════════════════════════════════════╝"
echo ""
echo -e "  ${YELLOW}Useful commands:${NC}"
echo "    docker compose ps      — check service status"
echo "    docker compose logs    — view all logs"
echo "    docker compose down    — stop Eirene"
echo "    docker compose up -d   — start Eirene"
echo ""
echo -e "  ${GREEN}εἰρήνη — Your tunnel is ready.${NC}"
echo ""

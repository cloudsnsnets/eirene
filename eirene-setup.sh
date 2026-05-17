#!/bin/bash
# ═══════════════════════════════════════════════════════════
# EIRENE Setup Wizard
# Cloud SNS Pty Ltd
# Free. Forever. Your tunnel. Your voice. Your rules.
# ═══════════════════════════════════════════════════════════

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

# ── Helper ────────────────────────────────────────────────────────────────────
die() { echo -e "${RED}✗ $1${NC}"; exit 1; }

# ── 1. Check Docker ───────────────────────────────────────────────────────────
echo -e "${CYAN}[1/5] Checking Docker...${NC}"

command -v docker > /dev/null 2>&1 || \
    die "Docker not found. Install from https://docs.docker.com/get-docker/"

docker compose version > /dev/null 2>&1 || \
    die "Docker Compose not found. Install Docker Compose plugin."

docker ps > /dev/null 2>&1 || \
    die "Cannot connect to Docker. Run: sudo usermod -aG docker \$USER — then open a new terminal."

echo -e "${GREEN}✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"
echo -e "${GREEN}✓ Docker Compose $(docker compose version --short)${NC}"

# ── 2. Cloudflare setup ───────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/5] Cloudflare setup...${NC}"
echo ""
echo "  You need a Cloudflare account with a domain."
echo "  If you don't have one:"
echo "    1. Sign up free at https://cloudflare.com"
echo "    2. Register a domain: Domains → Buy domain (~\$10/year)"
echo ""
echo "  Then create an API token:"
echo "    1. https://dash.cloudflare.com/profile/api-tokens"
echo "    2. Create Token → use 'Edit zone DNS' template"
echo "    3. Add permission: Account → Cloudflare Tunnel → Edit"
echo "    4. Create Token → copy it"
echo ""
read -p "  Paste your Cloudflare API token: " CF_API_TOKEN
echo ""

[ -z "$CF_API_TOKEN" ] && die "No token provided."

# Verify token
VERIFY=$(curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" \
    -H "Authorization: Bearer $CF_API_TOKEN")
echo "$VERIFY" | grep -q '"active"' || die "Token invalid or inactive. Check and try again."
echo -e "${GREEN}✓ Token verified${NC}"

# Get domain
read -p "  Your domain (e.g. eirenedesign.uk): " DOMAIN
echo ""

[ -z "$DOMAIN" ] && die "No domain provided."

# Get zone ID and account ID from domain in one call
ZONE_RESP=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
    -H "Authorization: Bearer $CF_API_TOKEN")

ZONE_ID=$(echo "$ZONE_RESP" | python3 -c \
    "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null)

ACCOUNT_ID=$(echo "$ZONE_RESP" | python3 -c \
    "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['account']['id'] if r else '')" 2>/dev/null)

[ -z "$ZONE_ID" ] && die "Domain '$DOMAIN' not found in your Cloudflare account. Make sure it is registered at Cloudflare."
echo -e "${GREEN}✓ Domain verified: $DOMAIN${NC}"

# ── 3. Create tunnel ──────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/5] Creating your private tunnel...${NC}"

# Try to create tunnel
TUNNEL_RESP=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"name\":\"eirene-home\",\"tunnel_secret\":\"$(openssl rand -base64 32)\"}")

TUNNEL_ID=$(echo "$TUNNEL_RESP" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d['result']['id'] if d.get('success') else '')" 2>/dev/null)

# If creation failed (e.g. tunnel already exists) — find existing one
if [ -z "$TUNNEL_ID" ]; then
    echo -e "  Tunnel already exists — using existing tunnel..."
    TUNNEL_ID=$(curl -s \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel?name=eirene-home&is_deleted=false" \
        -H "Authorization: Bearer $CF_API_TOKEN" | \
        python3 -c \
        "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')" 2>/dev/null)
fi

[ -z "$TUNNEL_ID" ] && die "Could not create or find tunnel. Check token has: Account → Cloudflare Tunnel → Edit permission."
echo -e "${GREEN}✓ Tunnel ready: ${TUNNEL_ID:0:8}...${NC}"

# Get tunnel token
TUNNEL_TOKEN=$(curl -s \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token" \
    -H "Authorization: Bearer $CF_API_TOKEN" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'] if d.get('success') else '')" 2>/dev/null)

[ -z "$TUNNEL_TOKEN" ] && die "Could not get tunnel token."
echo -e "${GREEN}✓ Tunnel token obtained${NC}"

# Create DNS records (ignore errors — records may already exist)
TUNNEL_CNAME="${TUNNEL_ID}.cfargotunnel.com"
echo -e "  Creating DNS records..."

curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"$DOMAIN\",\"content\":\"$TUNNEL_CNAME\",\"ttl\":1,\"proxied\":true}" \
    > /dev/null 2>&1 || true

curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"proxy.$DOMAIN\",\"content\":\"$TUNNEL_CNAME\",\"ttl\":1,\"proxied\":true}" \
    > /dev/null 2>&1 || true

echo -e "${GREEN}✓ DNS records created${NC}"

# Configure tunnel ingress routes
INGRESS_RESP=$(curl -s -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"config\":{\"ingress\":[
        {\"hostname\":\"$DOMAIN\",\"service\":\"http://eirene-pwa:8082\"},
        {\"hostname\":\"proxy.$DOMAIN\",\"service\":\"http://eirene-proxy:8080\"},
        {\"service\":\"http_status:404\"}
    ]}}")

echo "$INGRESS_RESP" | grep -q '"success":true' || \
    echo -e "${YELLOW}  ⚠ Route config may need retry — continuing...${NC}"

echo -e "${GREEN}✓ Tunnel routes configured${NC}"
echo -e "${GREEN}✓ https://$DOMAIN → Eirene PWA${NC}"
echo -e "${GREEN}✓ https://proxy.$DOMAIN → Eirene proxy${NC}"

# ── 4. Configure environment ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/5] Configuring Eirene...${NC}"

cp .env.example .env

SECRET=$(openssl rand -hex 32)
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$SECRET|" .env
sed -i "s|CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=$TUNNEL_TOKEN|" .env
sed -i "s|CF_API_TOKEN=.*|CF_API_TOKEN=$CF_API_TOKEN|" .env
sed -i "s|CF_ZONE_ID=.*|CF_ZONE_ID=$ZONE_ID|" .env
sed -i "s|CF_TUNNEL_ID=.*|CF_TUNNEL_ID=$TUNNEL_ID|" .env
sed -i "s|DOMAIN=.*|DOMAIN=$DOMAIN|" .env

echo -e "${GREEN}✓ JWT secret generated${NC}"
echo -e "${GREEN}✓ Environment configured${NC}"

# ── 5. Start Eirene ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[5/5] Starting Eirene...${NC}"

docker compose pull || die "Failed to pull images. Check your internet connection."
docker compose up -d || die "Failed to start services."

echo -e "  Waiting for voice auth service..."
ATTEMPTS=0
until docker exec eirene-voice-auth \
    python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8081/health')" \
    2>/dev/null; do
    sleep 3
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -gt 30 ]; then
        die "Voice auth failed to start. Check: docker logs eirene-voice-auth"
    fi
done

echo -e "${GREEN}✓ All services running${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${GREEN}Eirene is ready!${NC}"
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
echo "    docker compose ps      — check status"
echo "    docker compose logs    — view logs"
echo "    docker compose down    — stop Eirene"
echo "    docker compose up -d   — start Eirene"
echo ""
echo -e "  ${GREEN}εἰρήνη — Your tunnel is ready.${NC}"
echo ""

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
echo -e "${CYAN}[1/5] Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found.${NC}"
    echo "  Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"
echo -e "${GREEN}✓ Docker Compose $(docker compose version --short)${NC}"

# ── 2. Cloudflare API token ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[2/5] Cloudflare setup...${NC}"
echo ""
echo "  You need a Cloudflare account with a domain."
echo "  If you don't have one:"
echo "    1. Sign up free at https://cloudflare.com"
echo "    2. Register a domain at https://dash.cloudflare.com → Domains → Buy domain"
echo "       (~\$10/year — the only cost for Eirene)"
echo ""
echo "  Then create an API token:"
echo "    1. https://dash.cloudflare.com/profile/api-tokens"
echo "    2. Create Token → Use 'Edit zone DNS' template"
echo "    3. Add permission: Account → Cloudflare Tunnel → Edit"
echo "    4. Create Token → copy it"
echo ""
read -p "  Paste your Cloudflare API token: " CF_API_TOKEN
echo ""

if [ -z "$CF_API_TOKEN" ]; then
    echo -e "${RED}✗ No token provided. Exiting.${NC}"
    exit 1
fi

# Verify token
echo -e "  Verifying token..."
VERIFY=$(curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" \
    -H "Authorization: Bearer $CF_API_TOKEN")
if ! echo "$VERIFY" | grep -q '"active"'; then
    echo -e "${RED}✗ Token invalid or inactive. Check and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Token verified${NC}"

# Get account ID
ACCOUNT_ID=$(curl -s "https://api.cloudflare.com/client/v4/accounts" \
    -H "Authorization: Bearer $CF_API_TOKEN" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['id'])")

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}✗ Could not get account ID. Check token permissions.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Account ID: ${ACCOUNT_ID:0:8}...${NC}"

# Get zone
read -p "  Your domain (e.g. eirenedesign.uk): " DOMAIN
echo ""

ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
    -H "Authorization: Bearer $CF_API_TOKEN" | \
    python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')")

if [ -z "$ZONE_ID" ]; then
    echo -e "${RED}✗ Domain '$DOMAIN' not found in your Cloudflare account.${NC}"
    echo "  Make sure the domain is registered/transferred to Cloudflare."
    exit 1
fi
echo -e "${GREEN}✓ Domain verified: $DOMAIN${NC}"

# ── 3. Create tunnel automatically ───────────────────────────────────────────
echo ""
echo -e "${CYAN}[3/5] Creating your private tunnel...${NC}"

# Create tunnel
TUNNEL_RESP=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"name\":\"eirene-home\",\"tunnel_secret\":\"$(openssl rand -base64 32)\"}")

TUNNEL_ID=$(echo "$TUNNEL_RESP" | python3 -c \
    "import sys,json; print(json.load(sys.stdin)['result']['id'])" 2>/dev/null)

if [ -z "$TUNNEL_ID" ]; then
    # Tunnel might already exist — try to find it
    TUNNEL_ID=$(curl -s \
        "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel?name=eirene-home" \
        -H "Authorization: Bearer $CF_API_TOKEN" | \
        python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')")
fi

if [ -z "$TUNNEL_ID" ]; then
    echo -e "${RED}✗ Could not create tunnel. Check token has Cloudflare Tunnel:Edit permission.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tunnel created: ${TUNNEL_ID:0:8}...${NC}"

# Get tunnel token
TUNNEL_TOKEN=$(curl -s \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token" \
    -H "Authorization: Bearer $CF_API_TOKEN" | \
    python3 -c "import sys,json; print(json.load(sys.stdin)['result'])")

if [ -z "$TUNNEL_TOKEN" ]; then
    echo -e "${RED}✗ Could not get tunnel token.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tunnel token obtained${NC}"

# Create DNS records automatically
TUNNEL_CNAME="${TUNNEL_ID}.cfargotunnel.com"

echo -e "  Creating DNS records..."

# PWA record
curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"$DOMAIN\",\"content\":\"$TUNNEL_CNAME\",\"ttl\":1,\"proxied\":false}" \
    > /dev/null

# Proxy record
curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"CNAME\",\"name\":\"proxy.$DOMAIN\",\"content\":\"$TUNNEL_CNAME\",\"ttl\":1,\"proxied\":false}" \
    > /dev/null

echo -e "${GREEN}✓ DNS records created${NC}"
echo -e "${GREEN}✓ $DOMAIN → tunnel${NC}"
echo -e "${GREEN}✓ proxy.$DOMAIN → tunnel${NC}"

# Configure tunnel ingress
curl -s -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"config\":{\"ingress\":[{\"hostname\":\"$DOMAIN\",\"service\":\"http://eirene-pwa:8082\"},{\"hostname\":\"proxy.$DOMAIN\",\"service\":\"http://eirene-proxy:8080\"},{\"service\":\"http_status:404\"}]}}" \
    > /dev/null

echo -e "${GREEN}✓ Tunnel routes configured${NC}"

# ── 4. Configure environment ──────────────────────────────────────────────────
echo ""
echo -e "${CYAN}[4/5] Configuring Eirene...${NC}"

cp .env.example .env

# Generate JWT secret
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
docker compose pull
docker compose up -d

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

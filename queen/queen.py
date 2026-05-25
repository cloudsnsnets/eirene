"""
Queen Service -- Eirene Mesh Directory
Cloud SNS Pty Ltd
"""
import logging
import os
import uuid
import base64
import json
from datetime import datetime, timezone
from aiohttp import web
from db import init_db, get_pool
from crypto import (
    load_or_generate_queen_keys,
    queen_public_key_b64,
    generate_node_keypair,
    issue_certificate,
    verify_certificate,
    _queen_private,
)
from attestation import issue_challenge, verify_challenge

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("eirene.queen")
ADMIN_KEY = os.environ.get("QUEEN_ADMIN_KEY", "")

async def get_cert(request):
    header = request.headers.get("X-Node-Certificate", "")
    if not header:
        return None
    try:
        cert = json.loads(base64.b64decode(header))
        if not verify_certificate(cert):
            return None
        return cert
    except Exception:
        return None

async def health(request):
    pool = await get_pool()
    async with pool.acquire() as conn:
        full = await conn.fetchval("SELECT COUNT(*) FROM nodes WHERE tier='full'")
        prov = await conn.fetchval("SELECT COUNT(*) FROM nodes WHERE tier='provisional'")
    return web.json_response({
        "status": "ok", "version": "1.0",
        "nodes_full": full, "nodes_provisional": prov,
        "queen_public_key": queen_public_key_b64(),
    })

async def register(request):
    try:
        body = await request.json()
        route    = body.get("route", "").strip().rstrip("/")
        country  = body.get("country", "").strip().upper()
        capacity = int(body.get("capacity", 10))
        if not route or not country:
            return web.json_response({"status": "error", "detail": "route and country required"}, status=400)
        pool = await get_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow("SELECT id FROM nodes WHERE route=$1 AND tier!='revoked'", route)
        if existing:
            return web.json_response({"status": "error", "detail": "route already registered"}, status=409)
        ch = await issue_challenge(route)
        log.info(f"Challenge issued for {route}")
        return web.json_response({
            "status": "challenge_issued",
            "challenge_id": ch["challenge_id"],
            "challenge": ch["challenge"],
            "instructions": "POST /challenge within 10 minutes",
        })
    except Exception as e:
        log.error(f"Register error: {e}")
        return web.json_response({"status": "error", "detail": str(e)}, status=500)

async def challenge(request):
    try:
        body = await request.json()
        challenge_id     = body.get("challenge_id", "")
        signed_challenge = body.get("signed_challenge", "")
        public_key_b64   = body.get("public_key", "")
        image_hashes     = body.get("image_hashes", {})
        route            = body.get("route", "").strip().rstrip("/")
        country          = body.get("country", "AU").strip().upper()
        capacity         = int(body.get("capacity", 10))
        ok, reason = await verify_challenge(challenge_id, signed_challenge, public_key_b64, image_hashes)
        if not ok:
            log.warning(f"Attestation failed: {reason}")
            return web.json_response({"status": "error", "detail": reason}, status=400)
        node_priv_b64, node_pub_b64 = generate_node_keypair()
        node_id = str(uuid.uuid4())
        cert = issue_certificate(node_id, node_pub_b64, country, "provisional")
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO nodes (id, public_key, route, country, tier, capacity, last_seen) VALUES ($1,$2,$3,$4,'provisional',$5,NOW())",
                node_id, node_pub_b64, route, country, capacity)
        log.info(f"Node registered: {node_id} ({route}) [{country}]")
        return web.json_response({
            "status": "registered", "node_id": node_id, "tier": "provisional",
            "certificate": cert, "private_key": node_priv_b64,
            "note": "Provisional for 30 days. Private key stored once -- save it securely.",
        })
    except Exception as e:
        log.error(f"Challenge error: {e}")
        return web.json_response({"status": "error", "detail": str(e)}, status=500)

async def neighbours(request):
    cert = await get_cert(request)
    if not cert:
        return web.json_response({"status": "error", "detail": "valid certificate required"}, status=401)
    if cert.get("tier") == "provisional":
        return web.json_response({"status": "error", "detail": "provisional nodes cannot download directory"}, status=403)
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("UPDATE nodes SET last_seen=NOW() WHERE id=$1", cert["node_id"])
        await conn.execute("REFRESH MATERIALIZED VIEW directory")
        rows = await conn.fetch("SELECT id, route, country, capacity FROM directory LIMIT 50")
    nodes = [{"node_id": str(r["id"]), "route": r["route"], "country": r["country"], "capacity": r["capacity"]} for r in rows]
    payload = {"nodes": nodes, "generated_at": datetime.now(timezone.utc).isoformat()}
    sig = _queen_private.sign(json.dumps(payload, sort_keys=True).encode())
    payload["queen_signature"] = base64.b64encode(sig).decode()
    return web.json_response(payload)

async def report(request):
    cert = await get_cert(request)
    if not cert:
        return web.json_response({"status": "error", "detail": "valid certificate required"}, status=401)
    try:
        body = await request.json()
        reported_id = body.get("reported_node_id", "")
        reason      = body.get("reason", "")
        evidence    = body.get("evidence", "")[:500]
        if not reported_id or not reason:
            return web.json_response({"status": "error", "detail": "reported_node_id and reason required"}, status=400)
        pool = await get_pool()
        async with pool.acquire() as conn:
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM strikes WHERE node_id=$1 AND struck_by=$2 AND struck_at > NOW() - INTERVAL '7 days'",
                reported_id, f"node:{cert['node_id']}")
            if count >= 3:
                return web.json_response({"status": "error", "detail": "report limit reached"}, status=429)
            report_id = str(uuid.uuid4())
            await conn.execute(
                "INSERT INTO strikes (id, node_id, reason, struck_by) VALUES ($1,$2,$3,$4)",
                report_id, reported_id, reason, f"node:{cert['node_id']}")
        log.info(f"Report filed: {reported_id} by {cert['node_id']}")
        return web.json_response({"status": "reported", "report_id": report_id})
    except Exception as e:
        return web.json_response({"status": "error", "detail": str(e)}, status=500)

async def revoke(request):
    if not ADMIN_KEY or request.headers.get("X-Admin-Key", "") != ADMIN_KEY:
        return web.json_response({"status": "error", "detail": "admin access required"}, status=403)
    node_id = request.match_info.get("node_id")
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM nodes WHERE id=$1", node_id)
        if not row:
            return web.json_response({"status": "error", "detail": "node not found"}, status=404)
        await conn.execute("UPDATE nodes SET tier='revoked', revoked_at=NOW() WHERE id=$1", node_id)
    log.info(f"Node revoked: {node_id}")
    return web.json_response({"status": "revoked", "node_id": node_id,
        "revoked_at": datetime.now(timezone.utc).isoformat()})

async def on_startup(app):
    await init_db()
    load_or_generate_queen_keys()
    log.info("Queen Service starting.")
    log.info(f"Public key: {queen_public_key_b64()[:20]}...")

app = web.Application()
app.on_startup.append(on_startup)
app.router.add_get("/health",              health)
app.router.add_post("/register",           register)
app.router.add_post("/challenge",          challenge)
app.router.add_get("/neighbours",          neighbours)
app.router.add_post("/report",             report)
app.router.add_delete("/revoke/{node_id}", revoke)

if __name__ == "__main__":
    log.info("Eirene Queen Service v1.0 on :8090")
    web.run_app(app, host="0.0.0.0", port=8090)

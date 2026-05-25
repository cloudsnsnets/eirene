"""
Queen Attestation -- Challenge/Response
Cloud SNS Pty Ltd
"""
import base64
import os
import secrets
import aiohttp
from db import get_pool
from crypto import verify_node_signature

KNOWN_IMAGE_HASHES = {
    "eirene-proxy":      os.environ.get("KNOWN_HASH_PROXY", ""),
    "eirene-voice-auth": os.environ.get("KNOWN_HASH_VOICE_AUTH", ""),
    "eirene-pwa":        os.environ.get("KNOWN_HASH_PWA", ""),
}

async def issue_challenge(node_route: str) -> dict:
    """Issue a random challenge for a node to sign."""
    challenge = secrets.token_bytes(32)
    challenge_b64 = base64.b64encode(challenge).decode()
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO challenges (node_route, challenge)
            VALUES ($1, $2)
            RETURNING id, expires_at
        """, node_route, challenge_b64)
    return {
        "challenge_id": str(row["id"]),
        "challenge":    challenge_b64,
    }

async def verify_challenge(challenge_id: str,
                            signed_challenge: str,
                            public_key_b64: str,
                            image_hashes: dict) -> tuple:
    """
    Verify challenge response. Returns (ok, reason).
    Checks:
      1. Challenge exists and not expired
      2. Node signature is valid
      3. Node /health responds correctly
      4. Image hashes match known-good (if configured)
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, node_route, challenge, expires_at, completed
            FROM challenges WHERE id = $1
        """, challenge_id)

    if not row:
        return False, "challenge_not_found"
    if row["completed"]:
        return False, "challenge_already_used"

    from datetime import datetime, timezone
    if datetime.now(timezone.utc) > row["expires_at"]:
        return False, "challenge_expired"

    # Verify node signature
    challenge_bytes = base64.b64decode(row["challenge"])
    if not verify_node_signature(public_key_b64, challenge_bytes, signed_challenge):
        return False, "invalid_signature"

    # Verify node /health endpoint
    node_route = row["node_route"]
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{node_route}/health", timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status != 200:
                    return False, "node_health_failed"
                health = await resp.json()
                if not health.get("enrolled"):
                    return False, "node_not_enrolled"
    except Exception as e:
        return False, f"node_unreachable: {e}"

    # Verify image hashes if configured
    for image, known_hash in KNOWN_IMAGE_HASHES.items():
        if known_hash and image_hashes.get(image) != known_hash:
            return False, f"hash_mismatch: {image}"

    # Mark challenge as completed
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE challenges SET completed = TRUE WHERE id = $1
        """, challenge_id)

    return True, "ok"

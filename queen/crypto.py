"""
Queen Cryptography -- Ed25519
Cloud SNS Pty Ltd
"""
import base64
import json
import os
from datetime import datetime, timezone, timedelta
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey, Ed25519PublicKey
)
from cryptography.hazmat.primitives.serialization import (
    Encoding, PublicFormat, PrivateFormat, NoEncryption
)

QUEEN_KEY_PATH = os.environ.get("QUEEN_KEY_PATH", "/data/queen_private.key")
_queen_private = None
_queen_public  = None

def load_or_generate_queen_keys():
    global _queen_private, _queen_public
    if os.path.exists(QUEEN_KEY_PATH):
        with open(QUEEN_KEY_PATH, "rb") as f:
            raw = base64.b64decode(f.read().strip())
            _queen_private = Ed25519PrivateKey.from_private_bytes(raw)
    else:
        _queen_private = Ed25519PrivateKey.generate()
        raw = _queen_private.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
        os.makedirs(os.path.dirname(QUEEN_KEY_PATH), exist_ok=True)
        with open(QUEEN_KEY_PATH, "wb") as f:
            f.write(base64.b64encode(raw))
        print(f"Queen private key generated at {QUEEN_KEY_PATH}")
    _queen_public = _queen_private.public_key()

def queen_public_key_b64() -> str:
    raw = _queen_public.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return base64.b64encode(raw).decode()

def generate_node_keypair() -> tuple:
    priv = Ed25519PrivateKey.generate()
    pub  = priv.public_key()
    priv_b64 = base64.b64encode(
        priv.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())
    ).decode()
    pub_b64 = base64.b64encode(
        pub.public_bytes(Encoding.Raw, PublicFormat.Raw)
    ).decode()
    return priv_b64, pub_b64

def issue_certificate(node_id: str, public_key_b64: str,
                      country: str, tier: str) -> dict:
    now = datetime.now(timezone.utc)
    cert = {
        "node_id":    node_id,
        "public_key": public_key_b64,
        "issued_at":  now.isoformat(),
        "valid_to":   (now + timedelta(days=365)).isoformat(),
        "tier":       tier,
        "country":    country,
    }
    payload = json.dumps(cert, sort_keys=True).encode()
    sig = _queen_private.sign(payload)
    cert["signature"] = base64.b64encode(sig).decode()
    return cert

def verify_node_signature(public_key_b64: str,
                           challenge: bytes,
                           signature_b64: str) -> bool:
    try:
        pub_raw = base64.b64decode(public_key_b64)
        pub = Ed25519PublicKey.from_public_bytes(pub_raw)
        sig = base64.b64decode(signature_b64)
        pub.verify(sig, challenge)
        return True
    except Exception:
        return False

def verify_certificate(cert: dict) -> bool:
    try:
        cert = dict(cert)
        sig = base64.b64decode(cert.pop("signature"))
        payload = json.dumps(cert, sort_keys=True).encode()
        _queen_public.verify(sig, payload)
        return True
    except Exception:
        return False

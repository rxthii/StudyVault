"""Small HS256 bearer-token helpers using only the Python standard library."""
import base64
import hashlib
import hmac
import json
import time
from typing import Optional


TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(user_id: str, secret: str) -> str:
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64encode(json.dumps({
        "sub": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64encode(signature)}"


def decode_access_token(token: str, secret: str) -> Optional[str]:
    try:
        header_part, payload_part, signature_part = token.split(".")
        signing_input = f"{header_part}.{payload_part}".encode("ascii")
        expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected_signature, _b64decode(signature_part)):
            return None

        header = json.loads(_b64decode(header_part))
        payload = json.loads(_b64decode(payload_part))
        if header.get("alg") != "HS256" or header.get("typ") != "JWT":
            return None
        user_id = payload.get("sub")
        expires_at = payload.get("exp")
        if not isinstance(user_id, str) or not user_id or not isinstance(expires_at, int):
            return None
        if expires_at <= int(time.time()):
            return None
        return user_id
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, UnicodeDecodeError):
        return None

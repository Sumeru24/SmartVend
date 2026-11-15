import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings

PBKDF2_ITERATIONS = 600_000
_HASH_ALGORITHM = "sha256"


def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 with a unique 16-byte salt."""
    if len(password) < 8:
        raise ValueError("Password must contain at least 8 characters.")
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        _HASH_ALGORITHM, password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac(
            _HASH_ALGORITHM, password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

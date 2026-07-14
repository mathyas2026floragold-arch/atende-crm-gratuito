import base64
import binascii
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
import jwt
from jwt import PyJWTError
from .config import get_settings


def authenticate_admin_credentials(username: str, password: str) -> bool:
    settings = get_settings()
    return secrets.compare_digest(username.strip().casefold(), settings.crm_admin_user.strip().casefold()) and secrets.compare_digest(
        password, settings.crm_admin_password
    )


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return f"pbkdf2_sha256$240000${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, rounds, salt64, digest64 = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt64)
        expected = base64.b64decode(digest64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds))
        return secrets.compare_digest(actual, expected)
    except (ValueError, binascii.Error):
        return False


def create_admin_session(subject: str = "crm-admin", role: str = "admin", name: str = "Administrador") -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode({"sub": subject, "role": role, "name": name, "exp": expires}, settings.app_secret, algorithm="HS256")


def session_payload(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return jwt.decode(token, get_settings().app_secret, algorithms=["HS256"])
    except PyJWTError:
        return None


def is_admin_session(token: str | None) -> bool:
    return session_payload(token) is not None


def is_admin_authorized(authorization: str | None) -> bool:
    """Aceita o token interno ou o login HTTP Basic usado no Northflank."""
    if not authorization:
        return False
    settings = get_settings()
    bearer = f"Bearer {settings.app_secret}"
    if secrets.compare_digest(authorization, bearer):
        return True
    if not authorization.startswith("Basic ") or not settings.crm_admin_password:
        return False
    try:
        decoded = base64.b64decode(authorization[6:]).decode("utf-8")
        username, password = decoded.split(":", 1)
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return False
    return authenticate_admin_credentials(username, password)

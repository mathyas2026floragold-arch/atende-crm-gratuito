import base64
import binascii
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


def create_admin_session() -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    return jwt.encode({"sub": "crm-admin", "exp": expires}, settings.app_secret, algorithm="HS256")


def is_admin_session(token: str | None) -> bool:
    if not token:
        return False
    try:
        payload = jwt.decode(token, get_settings().app_secret, algorithms=["HS256"])
        return secrets.compare_digest(str(payload.get("sub", "")), "crm-admin")
    except PyJWTError:
        return False


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

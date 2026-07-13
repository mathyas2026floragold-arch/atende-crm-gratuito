import base64
import binascii
import secrets
from .config import get_settings


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
    return secrets.compare_digest(username.strip().casefold(), settings.crm_admin_user.strip().casefold()) and secrets.compare_digest(
        password, settings.crm_admin_password
    )

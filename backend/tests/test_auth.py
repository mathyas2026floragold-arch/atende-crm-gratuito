import base64
import os
import unittest
from app.auth import create_admin_session, is_admin_authorized, is_admin_session
from app.config import get_settings


class AdminAuthorizationTests(unittest.TestCase):
    def setUp(self):
        self.original = {key: os.environ.get(key) for key in ("APP_SECRET", "CRM_ADMIN_USER", "CRM_ADMIN_PASSWORD")}
        os.environ["APP_SECRET"] = "token-interno"
        os.environ["CRM_ADMIN_USER"] = "admin"
        os.environ["CRM_ADMIN_PASSWORD"] = "senha-forte"
        get_settings.cache_clear()

    def tearDown(self):
        for key, value in self.original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        get_settings.cache_clear()

    def test_accepts_internal_bearer_token(self):
        self.assertTrue(is_admin_authorized("Bearer token-interno"))

    def test_accepts_correct_basic_login(self):
        encoded = base64.b64encode(b"admin:senha-forte").decode()
        self.assertTrue(is_admin_authorized(f"Basic {encoded}"))

    def test_accepts_admin_username_with_different_case(self):
        encoded = base64.b64encode(b"Admin:senha-forte").decode()
        self.assertTrue(is_admin_authorized(f"Basic {encoded}"))

    def test_rejects_wrong_basic_password(self):
        encoded = base64.b64encode(b"admin:senha-errada").decode()
        self.assertFalse(is_admin_authorized(f"Basic {encoded}"))

    def test_creates_valid_browser_session(self):
        self.assertTrue(is_admin_session(create_admin_session()))

    def test_rejects_invalid_browser_session(self):
        self.assertFalse(is_admin_session("token-invalido"))


if __name__ == "__main__":
    unittest.main()

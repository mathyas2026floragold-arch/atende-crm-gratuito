from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_secret: str = "development-only"
    public_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    database_url: str = ""
    redis_url: str = ""
    crm_admin_user: str = "admin"
    crm_admin_password: str = ""
    evolution_base_url: str = "http://localhost:8080"
    evolution_api_key: str = ""
    evolution_instance: str = "empresa-principal"
    evolution_webhook_token: str = "development-webhook"
    frontend_dist: str = "/app/frontend-dist"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash"
    ai_enabled: bool = True
    ai_debounce_seconds: int = 8
    default_company_slug: str = "minha-empresa"
    default_company_name: str = "Minha Empresa"
    default_access_message: str = "Pagamento confirmado! Aqui está o seu acesso: {access_url}"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

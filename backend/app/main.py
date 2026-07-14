from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from .auth import is_admin_authorized, is_admin_session
from .config import get_settings
from .database import connect_db, disconnect_db
from .routers import api, webhooks


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_db()
    yield
    await disconnect_db()


settings = get_settings()
app = FastAPI(title="Atende CRM API", version="2.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.public_url, settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def protect_combined_crm(request: Request, call_next):
    """Protege painel e API quando o frontend e backend rodam juntos."""
    path = request.url.path
    public_path = (
        path == "/health"
        or path.startswith("/webhooks/")
        or path == "/api/auth/login"
        or not path.startswith("/api/")
    )
    if settings.crm_admin_password and not public_path:
        authorized = is_admin_authorized(request.headers.get("authorization"))
        if not authorized and is_admin_session(request.cookies.get("atende_session")):
            headers = [(key, value) for key, value in request.scope["headers"] if key != b"authorization"]
            headers.append((b"authorization", f"Bearer {settings.app_secret}".encode()))
            request.scope["headers"] = headers
            authorized = True
        if not authorized:
            return JSONResponse(
                {"detail": "Login necessário"},
                status_code=401,
            )
    return await call_next(request)


app.include_router(webhooks.router)
app.include_router(api.router)


@app.get("/health")
async def health():
    return {"online": True, "service": "atende-crm-api", "environment": settings.app_env}


frontend_dir = Path(settings.frontend_dist)
if frontend_dir.exists():
    assets_dir = frontend_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def frontend_spa(full_path: str):
        requested = (frontend_dir / full_path).resolve()
        if frontend_dir.resolve() in requested.parents and requested.is_file():
            return FileResponse(requested)
        return FileResponse(frontend_dir / "index.html")

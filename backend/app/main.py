from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .database import connect_db, disconnect_db
from .routers import api, webhooks


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(title="Atende CRM API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().public_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)
app.include_router(webhooks.router)
app.include_router(api.router)


@app.get("/health")
async def health():
    return {"online": True, "service": "atende-crm-api", "environment": get_settings().app_env}

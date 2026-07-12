import asyncpg
from .config import get_settings

pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    global pool
    url = get_settings().database_url
    if not url:
        return
    pool = await asyncpg.create_pool(url, min_size=1, max_size=8, command_timeout=30)


async def disconnect_db() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None


def db() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("DATABASE_URL não configurada ou banco indisponível")
    return pool

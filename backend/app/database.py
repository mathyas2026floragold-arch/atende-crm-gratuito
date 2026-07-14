import asyncpg
from .config import get_settings

pool: asyncpg.Pool | None = None


async def connect_db() -> None:
    global pool
    url = get_settings().database_url
    if not url:
        return
    pool = await asyncpg.create_pool(url, min_size=1, max_size=8, command_timeout=30)
    async with pool.acquire() as conn:
        # Migrações idempotentes para instalações existentes. O projeto é
        # distribuído em um único container e precisa evoluir sem apagar dados.
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text")
        await conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS actor text")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name text")
        await conn.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type text")
        await conn.execute(
            """CREATE OR REPLACE VIEW conversation_inbox AS
            SELECT c.id,c.company_id,c.status,c.ai_mode,c.handoff_reason,c.updated_at,
            ct.name AS contact_name,ct.phone,w.instance_name,u.name AS assigned_user,
            (SELECT COALESCE(NULLIF(m.content,''),m.file_name,m.media_type,'Mídia recebida')
             FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_message
            FROM conversations c JOIN contacts ct ON ct.id=c.contact_id
            JOIN whatsapp_connections w ON w.id=c.channel_id
            LEFT JOIN users u ON u.id=c.assigned_user_id"""
        )


async def disconnect_db() -> None:
    global pool
    if pool:
        await pool.close()
        pool = None


def db() -> asyncpg.Pool:
    if pool is None:
        raise RuntimeError("DATABASE_URL não configurada ou banco indisponível")
    return pool

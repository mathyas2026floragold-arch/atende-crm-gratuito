import asyncio
import redis.asyncio as redis
from ..config import get_settings


async def is_latest_message(conversation_id: str, message_id: str) -> bool:
    """Waits briefly and lets only the latest message in a burst trigger the AI."""
    settings = get_settings()
    client = redis.from_url(settings.redis_url, decode_responses=True)
    key = f"debounce:{conversation_id}"
    try:
        await client.set(key, message_id, ex=max(settings.ai_debounce_seconds * 3, 30))
        await asyncio.sleep(settings.ai_debounce_seconds)
        return await client.get(key) == message_id
    finally:
        await client.aclose()

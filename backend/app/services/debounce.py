import asyncio
import redis.asyncio as redis
from ..config import get_settings

_local_latest: dict[str, str] = {}


async def _local_debounce(key: str, message_id: str, delay: int) -> bool:
    _local_latest[key] = message_id
    await asyncio.sleep(delay)
    is_latest = _local_latest.get(key) == message_id
    if is_latest:
        _local_latest.pop(key, None)
    return is_latest


async def is_latest_message(conversation_id: str, message_id: str) -> bool:
    """Waits briefly and lets only the latest message in a burst trigger the AI."""
    settings = get_settings()
    key = f"debounce:{conversation_id}"
    if not settings.redis_url:
        return await _local_debounce(key, message_id, settings.ai_debounce_seconds)
    client = redis.from_url(settings.redis_url, decode_responses=True)
    try:
        await client.set(key, message_id, ex=max(settings.ai_debounce_seconds * 3, 30))
        await asyncio.sleep(settings.ai_debounce_seconds)
        return await client.get(key) == message_id
    except Exception:
        return await _local_debounce(key, message_id, settings.ai_debounce_seconds)
    finally:
        await client.aclose()

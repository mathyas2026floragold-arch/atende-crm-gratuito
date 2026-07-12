def extract_event(payload: dict) -> dict | None:
    if payload.get("event") not in {"messages.upsert", "MESSAGES_UPSERT"}:
        return None
    data = payload.get("data") or {}
    key = data.get("key") or {}
    if key.get("fromMe"):
        return None
    message = data.get("message") or {}
    text = (
        message.get("conversation")
        or (message.get("extendedTextMessage") or {}).get("text")
        or (message.get("imageMessage") or {}).get("caption")
        or (message.get("documentMessage") or {}).get("caption")
        or ""
    )
    media_type = next(
        (kind for kind, field in [("image", "imageMessage"), ("audio", "audioMessage"), ("video", "videoMessage"), ("document", "documentMessage")] if field in message),
        None,
    )
    return {
        "instance": payload.get("instance") or data.get("instance"),
        "phone": str(key.get("remoteJid", "")).split("@")[0],
        "name": data.get("pushName"),
        "external_id": key.get("id"),
        "text": text,
        "media_type": media_type,
        "media_base64": data.get("base64") or payload.get("base64"),
        "mime_type": (
            (message.get("imageMessage") or {}).get("mimetype")
            or (message.get("audioMessage") or {}).get("mimetype")
            or (message.get("videoMessage") or {}).get("mimetype")
            or (message.get("documentMessage") or {}).get("mimetype")
        ),
    }

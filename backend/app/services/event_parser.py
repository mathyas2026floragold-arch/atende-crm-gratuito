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
    media_base64 = data.get("base64") or payload.get("base64")
    mime_type = (
        (message.get("imageMessage") or {}).get("mimetype")
        or (message.get("audioMessage") or {}).get("mimetype")
        or (message.get("videoMessage") or {}).get("mimetype")
        or (message.get("documentMessage") or {}).get("mimetype")
    )
    file_name = (message.get("documentMessage") or {}).get("fileName")
    remote_jid = str(key.get("remoteJid") or "")
    remote_jid_alt = str(
        key.get("remoteJidAlt")
        or key.get("senderPn")
        or data.get("remoteJidAlt")
        or data.get("senderPn")
        or ""
    )
    remote_phone = remote_jid.split("@")[0]
    alternate_phone = remote_jid_alt.split("@")[0]

    # Versões recentes do WhatsApp podem entregar um identificador LID em
    # remoteJid. Ele identifica o contato, mas não é aceito pelo endpoint
    # sendText da Evolution. Quando presente, remoteJidAlt contém o telefone.
    phone = alternate_phone if remote_jid.endswith("@lid") and alternate_phone else remote_phone
    lid = remote_phone if remote_jid.endswith("@lid") else None

    return {
        "instance": payload.get("instance") or data.get("instance"),
        "phone": phone,
        "lid": lid,
        "name": data.get("pushName"),
        "external_id": key.get("id"),
        "text": text,
        "media_type": media_type,
        "media_base64": media_base64,
        "media_url": (media_base64 if str(media_base64).startswith("data:") else f"data:{mime_type};base64,{media_base64}") if media_base64 and mime_type else None,
        "mime_type": mime_type,
        "file_name": file_name,
    }

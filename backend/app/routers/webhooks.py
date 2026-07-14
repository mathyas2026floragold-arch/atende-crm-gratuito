from fastapi import APIRouter, BackgroundTasks, HTTPException
from ..config import get_settings
from ..database import db
from .. import repository
from ..services.evolution import EvolutionClient
from ..services.event_parser import extract_event
from ..services.gemini import GeminiClient
from ..services.debounce import is_latest_message
from ..services.payment_trigger import detect_payment_claim

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/evolution/{token}")
async def evolution_webhook(token: str, payload: dict, background: BackgroundTasks):
    if token != get_settings().evolution_webhook_token:
        raise HTTPException(401, "Token inválido")
    event = extract_event(payload)
    if not event:
        return {"received": True, "ignored": True}
    background.add_task(process_message, event)
    return {"received": True}


async def process_message(event: dict) -> None:
    company = await repository.company_by_instance(event["instance"])
    if not company:
        return
    channel = await db().fetchrow(
        "SELECT id FROM whatsapp_connections WHERE company_id=$1 AND instance_name=$2",
        company["id"], event["instance"],
    )
    contact = await repository.upsert_contact(
        company["id"], event["phone"], event["name"], event.get("lid")
    )
    conversation = await repository.open_conversation(company["id"], contact["id"], channel["id"])
    saved = await repository.save_message(
        conversation["id"], "in", event["text"], event["external_id"], event["media_type"],
        event.get("media_url"), event.get("mime_type"), event.get("file_name"), "customer",
    )
    if not saved:
        return

    gemini = GeminiClient()
    detection = detect_payment_claim(event["text"], event["media_type"], event["text"])
    if not detection.triggered and event["media_type"] in {"image", "document"}:
        if await gemini.is_payment_proof(event.get("media_base64"), event.get("mime_type")):
            from ..services.payment_trigger import PaymentDetection
            detection = PaymentDetection(True, "payment_proof_visual", 0.94)
    evolution = EvolutionClient()
    if detection.triggered:
        await repository.pause_for_payment(conversation["id"], detection.reason or "payment")
        reply = "Recebi. Vou encaminhar agora para a equipe conferir o Pix e liberar seu acesso."
        await evolution.send_text(event["phone"], reply)
        await repository.save_message(conversation["id"], "out", reply, None, actor="ai")
        return

    if conversation["ai_mode"] != "autonomous" or not get_settings().ai_enabled:
        return
    if not await is_latest_message(str(conversation["id"]), event["external_id"] or str(saved["id"])):
        return
    context = company["ai_context"] or "Atenda conforme as informações fornecidas pela empresa."
    messages = [dict(row) for row in reversed(await repository.history(conversation["id"]))]
    grouped_text = await repository.unanswered_customer_text(conversation["id"])
    try:
        answer = await gemini.answer(grouped_text or event["text"], messages, context, event.get("media_base64"), event.get("mime_type"))
    except Exception as error:
        # Não simula IA quando o Gemini está indisponível. Pausa a automação e
        # deixa um motivo auditável para um humano assumir a conversa.
        await db().execute(
            "UPDATE conversations SET ai_mode='paused',handoff_reason='ai_error',updated_at=now() WHERE id=$1",
            conversation["id"],
        )
        answer = "Tive uma instabilidade no atendimento automático. Vou encaminhar sua conversa para nossa equipe continuar por aqui."
    await evolution.send_text(event["phone"], answer)
    await repository.save_message(conversation["id"], "out", answer, None, actor="ai")

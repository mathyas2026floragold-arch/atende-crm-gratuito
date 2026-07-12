from uuid import UUID
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from ..auth import is_admin_authorized
from ..config import get_settings
from ..database import db
from ..services.evolution import EvolutionClient

router = APIRouter(prefix="/api", tags=["crm"])


def verify_admin(authorization: str | None) -> None:
    if not is_admin_authorized(authorization):
        raise HTTPException(401, "Não autorizado", headers={"WWW-Authenticate": 'Basic realm="Atende CRM"'})


@router.get("/conversations")
async def conversations(authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    rows = await db().fetch("""SELECT v.* FROM conversation_inbox v ORDER BY v.updated_at DESC LIMIT 100""")
    return [dict(row) for row in rows]


@router.get("/conversations/{conversation_id}/messages")
async def messages(conversation_id: UUID, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    rows = await db().fetch("SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at", conversation_id)
    return [dict(row) for row in rows]


class ConfirmPayment(BaseModel):
    access_url: str | None = None
    access_message: str | None = None
    confirmed_by: UUID | None = None


class HumanMessage(BaseModel):
    content: str


@router.post("/conversations/{conversation_id}/messages")
async def send_human_message(
    conversation_id: UUID,
    body: HumanMessage,
    authorization: str | None = Header(default=None),
):
    """Envia uma mensagem manual e impede a IA de responder em paralelo."""
    verify_admin(authorization)
    content = body.content.strip()
    if not content:
        raise HTTPException(422, "A mensagem não pode ficar vazia")
    row = await db().fetchrow(
        """SELECT c.id,ct.phone FROM conversations c
        JOIN contacts ct ON ct.id=c.contact_id WHERE c.id=$1""",
        conversation_id,
    )
    if not row:
        raise HTTPException(404, "Conversa não encontrada")
    await EvolutionClient().send_text(row["phone"], content)
    async with db().acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """UPDATE conversations SET ai_mode='human_exclusive',
                status=CASE WHEN status='new' THEN 'in_progress' ELSE status END,
                updated_at=now() WHERE id=$1""",
                conversation_id,
            )
            message = await conn.fetchrow(
                """INSERT INTO messages(conversation_id,direction,content,status)
                VALUES($1,'out',$2,'sent') RETURNING *""",
                conversation_id,
                content,
            )
    return dict(message)


@router.post("/conversations/{conversation_id}/confirm-payment")
async def confirm_payment(conversation_id: UUID, body: ConfirmPayment, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    row = await db().fetchrow("""SELECT c.*,ct.phone,co.access_url AS company_access_url
        FROM conversations c JOIN contacts ct ON ct.id=c.contact_id JOIN companies co ON co.id=c.company_id WHERE c.id=$1""", conversation_id)
    if not row:
        raise HTTPException(404, "Conversa não encontrada")
    if row["status"] != "awaiting_payment_confirmation":
        raise HTTPException(409, "Conversa não está aguardando confirmação")
    access_url = body.access_url or row["company_access_url"]
    if not access_url:
        raise HTTPException(422, "Cadastre o link de acesso antes de confirmar")
    template = body.access_message or get_settings().default_access_message
    text = template.format(access_url=access_url)
    await EvolutionClient().send_text(row["phone"], text)
    async with db().acquire() as conn:
        async with conn.transaction():
            await conn.execute("UPDATE conversations SET status='resolved',ai_mode='human_exclusive',payment_confirmed_at=now(),updated_at=now() WHERE id=$1", conversation_id)
            await conn.execute("INSERT INTO messages(conversation_id,direction,content,status) VALUES($1,'out',$2,'sent')", conversation_id, text)
            await conn.execute("INSERT INTO payments(company_id,conversation_id,status,confirmed_by,confirmed_at) VALUES($1,$2,'confirmed',$3,now())", row["company_id"], conversation_id, body.confirmed_by)
            await conn.execute("INSERT INTO audit_logs(company_id,user_id,entity_type,entity_id,action,details) VALUES($1,$2,'conversation',$3,'payment_confirmed_and_access_sent',jsonb_build_object('access_url',$4))", row["company_id"], body.confirmed_by, conversation_id, access_url)
    return {"ok": True, "status": "resolved", "access_sent": True}


@router.post("/conversations/{conversation_id}/resume-ai")
async def resume_ai(conversation_id: UUID, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    await db().execute("UPDATE conversations SET status='in_progress',ai_mode='autonomous',handoff_reason=NULL,updated_at=now() WHERE id=$1", conversation_id)
    return {"ok": True, "ai_mode": "autonomous"}


@router.get("/connections/qr")
async def connection_qr(authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    return await EvolutionClient().qr_code()


@router.post("/connections/setup")
async def setup_connection(authorization: str | None = Header(default=None)):
    """Cria a instância e configura o webhook sem exigir terminal."""
    verify_admin(authorization)
    return await EvolutionClient().setup_instance()


@router.get("/connections/state")
async def connection_state(authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    return await EvolutionClient().connection_state()

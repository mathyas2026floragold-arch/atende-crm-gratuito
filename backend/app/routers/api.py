from uuid import UUID
from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel
from ..auth import authenticate_admin_credentials, create_admin_session, is_admin_authorized
from ..config import get_settings
from ..database import db
from ..services.evolution import EvolutionClient

router = APIRouter(prefix="/api", tags=["crm"])


class AdminLogin(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def admin_login(body: AdminLogin, response: Response):
    if not authenticate_admin_credentials(body.username, body.password):
        raise HTTPException(401, "Usuário ou senha inválidos")
    response.set_cookie(
        "atende_session",
        create_admin_session(),
        max_age=86400,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"ok": True, "user": get_settings().crm_admin_user}


@router.post("/auth/logout")
async def admin_logout(response: Response, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    response.delete_cookie("atende_session", path="/")
    return {"ok": True}


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


class CompanySettings(BaseModel):
    name: str
    access_url: str | None = None
    ai_context: str | None = None


@router.get("/settings")
async def get_company_settings(authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    row = await db().fetchrow(
        "SELECT name,access_url,ai_context FROM companies WHERE slug=$1 AND active=true",
        get_settings().default_company_slug,
    )
    if not row:
        raise HTTPException(404, "Empresa não encontrada")
    return dict(row)


@router.put("/settings")
async def update_company_settings(body: CompanySettings, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    name = body.name.strip()
    if not name:
        raise HTTPException(422, "Informe o nome da empresa")
    row = await db().fetchrow(
        """UPDATE companies SET name=$2,access_url=$3,ai_context=$4
        WHERE slug=$1 AND active=true RETURNING name,access_url,ai_context""",
        get_settings().default_company_slug,
        name,
        (body.access_url or "").strip() or None,
        (body.ai_context or "").strip() or None,
    )
    if not row:
        raise HTTPException(404, "Empresa não encontrada")
    return dict(row)


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

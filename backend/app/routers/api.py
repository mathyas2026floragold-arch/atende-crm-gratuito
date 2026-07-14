import base64
from uuid import UUID
from fastapi import APIRouter, File, Form, Header, HTTPException, Response, UploadFile
from pydantic import BaseModel
from ..auth import authenticate_admin_credentials, create_admin_session, hash_password, is_admin_authorized, verify_password
from ..config import get_settings
from ..database import db
from ..services.evolution import EvolutionClient
from ..services.gemini import GeminiClient

router = APIRouter(prefix="/api", tags=["crm"])


class AdminLogin(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
async def admin_login(body: AdminLogin, response: Response):
    subject, role, name = "crm-admin", "admin", "Administrador"
    if not authenticate_admin_credentials(body.username, body.password):
        user = await db().fetchrow(
            """SELECT id,name,role,password_hash FROM users
            WHERE lower(email)=lower($1) AND active=true""", body.username.strip()
        )
        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(401, "Usuário ou senha inválidos")
        subject, role, name = str(user["id"]), user["role"], user["name"]
    response.set_cookie(
        "atende_session",
        create_admin_session(subject, role, name),
        max_age=86400,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    return {"ok": True, "user": {"id": subject, "name": name, "role": role}}


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


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "agent"


class UserUpdate(BaseModel):
    name: str | None = None
    password: str | None = None
    role: str | None = None
    active: bool | None = None


@router.get("/users")
async def list_users(authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    rows = await db().fetch(
        """SELECT id,name,email,role,active,created_at,updated_at FROM users
        WHERE company_id=(SELECT id FROM companies WHERE slug=$1) ORDER BY name""",
        get_settings().default_company_slug,
    )
    return [dict(row) for row in rows]


@router.post("/users", status_code=201)
async def create_user(body: UserCreate, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    role = body.role.strip().lower()
    if role not in {"admin", "supervisor", "agent", "finance", "marketing"}:
        raise HTTPException(422, "Perfil inválido")
    if len(body.password) < 8:
        raise HTTPException(422, "A senha deve ter pelo menos 8 caracteres")
    try:
        row = await db().fetchrow(
            """INSERT INTO users(company_id,name,email,role,password_hash)
            SELECT id,$2,lower($3),$4,$5 FROM companies WHERE slug=$1
            RETURNING id,name,email,role,active,created_at,updated_at""",
            get_settings().default_company_slug, body.name.strip(), body.email.strip(), role, hash_password(body.password),
        )
    except Exception as error:
        if "users_company_id_email_key" in str(error):
            raise HTTPException(409, "Já existe um usuário com este e-mail") from error
        raise
    return dict(row)


@router.put("/users/{user_id}")
async def update_user(user_id: UUID, body: UserUpdate, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    if body.role is not None and body.role not in {"admin", "supervisor", "agent", "finance", "marketing"}:
        raise HTTPException(422, "Perfil inválido")
    if body.password is not None and len(body.password) < 8:
        raise HTTPException(422, "A senha deve ter pelo menos 8 caracteres")
    row = await db().fetchrow(
        """UPDATE users SET name=COALESCE($2,name),role=COALESCE($3,role),
        active=COALESCE($4,active),password_hash=COALESCE($5,password_hash),updated_at=now()
        WHERE id=$1 RETURNING id,name,email,role,active,created_at,updated_at""",
        user_id, body.name.strip() if body.name else None, body.role, body.active,
        hash_password(body.password) if body.password else None,
    )
    if not row:
        raise HTTPException(404, "Usuário não encontrado")
    return dict(row)


@router.get("/ai/status")
async def ai_status(authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    settings = get_settings()
    return {"enabled": settings.ai_enabled, "configured": bool(settings.gemini_api_key), "model": settings.gemini_model}


class AiTest(BaseModel):
    message: str = "Olá, apresente-se brevemente."


@router.post("/ai/test")
async def test_ai(body: AiTest, authorization: str | None = Header(default=None)):
    verify_admin(authorization)
    company = await db().fetchrow(
        "SELECT ai_context FROM companies WHERE slug=$1", get_settings().default_company_slug
    )
    if not get_settings().gemini_api_key:
        raise HTTPException(503, "GEMINI_API_KEY não configurada no backend")
    try:
        answer = await GeminiClient().answer(body.message, [], company["ai_context"] or "", None, None)
    except Exception as error:
        raise HTTPException(502, f"Gemini indisponível: {str(error)[:180]}") from error
    return {"ok": True, "answer": answer, "model": get_settings().gemini_model}


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
                """INSERT INTO messages(conversation_id,direction,content,status,actor)
                VALUES($1,'out',$2,'sent','human') RETURNING *""",
                conversation_id,
                content,
            )
    return dict(message)


@router.post("/conversations/{conversation_id}/media")
async def send_human_media(
    conversation_id: UUID,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    authorization: str | None = Header(default=None),
):
    verify_admin(authorization)
    raw = await file.read()
    if not raw:
        raise HTTPException(422, "O arquivo está vazio")
    if len(raw) > 16 * 1024 * 1024:
        raise HTTPException(413, "O arquivo deve ter no máximo 16 MB")
    mime = (file.content_type or "application/octet-stream").lower()
    media_type = "image" if mime.startswith("image/") else "video" if mime.startswith("video/") else "audio" if mime.startswith("audio/") else "document"
    row = await db().fetchrow(
        """SELECT c.id,ct.phone FROM conversations c JOIN contacts ct ON ct.id=c.contact_id
        WHERE c.id=$1""", conversation_id,
    )
    if not row:
        raise HTTPException(404, "Conversa não encontrada")
    encoded = base64.b64encode(raw).decode()
    await EvolutionClient().send_media(row["phone"], media_type, mime, encoded, file.filename or f"arquivo-{conversation_id}", caption.strip())
    data_url = f"data:{mime};base64,{encoded}"
    message = await db().fetchrow(
        """INSERT INTO messages(conversation_id,direction,content,media_type,media_url,file_name,mime_type,status,actor)
        VALUES($1,'out',$2,$3,$4,$5,$6,'sent','human') RETURNING *""",
        conversation_id, caption.strip(), media_type, data_url, file.filename, mime,
    )
    await db().execute("UPDATE conversations SET ai_mode='human_exclusive',status=CASE WHEN status='new' THEN 'in_progress' ELSE status END,updated_at=now() WHERE id=$1", conversation_id)
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
            await conn.execute("INSERT INTO messages(conversation_id,direction,content,status,actor) VALUES($1,'out',$2,'sent','human')", conversation_id, text)
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

from uuid import UUID
from .database import db


async def company_by_instance(instance: str):
    return await db().fetchrow(
        "SELECT c.* FROM companies c JOIN whatsapp_connections w ON w.company_id=c.id WHERE w.instance_name=$1 AND w.active=true",
        instance,
    )


async def upsert_contact(company_id: UUID, phone: str, name: str | None, previous_phone: str | None = None):
    if previous_phone and previous_phone != phone:
        migrated = await db().fetchrow(
            """UPDATE contacts SET phone=$2,name=COALESCE($3,name),updated_at=now()
            WHERE company_id=$1 AND phone=$4
              AND NOT EXISTS(SELECT 1 FROM contacts WHERE company_id=$1 AND phone=$2)
            RETURNING *""",
            company_id, phone, name, previous_phone,
        )
        if migrated:
            return migrated
    return await db().fetchrow(
        """INSERT INTO contacts(company_id, phone, name) VALUES($1,$2,$3)
        ON CONFLICT(company_id,phone) DO UPDATE SET name=COALESCE(EXCLUDED.name,contacts.name),updated_at=now()
        RETURNING *""",
        company_id, phone, name,
    )


async def open_conversation(company_id: UUID, contact_id: UUID, channel_id: UUID):
    row = await db().fetchrow(
        "SELECT * FROM conversations WHERE company_id=$1 AND contact_id=$2 AND status NOT IN ('resolved','cancelled') ORDER BY created_at DESC LIMIT 1",
        company_id, contact_id,
    )
    if row:
        return row
    return await db().fetchrow(
        "INSERT INTO conversations(company_id,contact_id,channel_id,status,ai_mode) VALUES($1,$2,$3,'new','autonomous') RETURNING *",
        company_id, contact_id, channel_id,
    )


async def save_message(conversation_id: UUID, direction: str, content: str, external_id: str | None, media_type: str | None = None):
    row = await db().fetchrow(
        """INSERT INTO messages(conversation_id,direction,content,external_id,media_type,status)
        VALUES($1,$2,$3,$4,$5,'received') ON CONFLICT(external_id) DO NOTHING RETURNING *""",
        conversation_id, direction, content, external_id, media_type,
    )
    if row:
        await db().execute(
            """UPDATE conversations SET updated_at=now(),
            status=CASE WHEN status='new' THEN 'in_progress' ELSE status END
            WHERE id=$1""",
            conversation_id,
        )
    return row


async def history(conversation_id: UUID):
    return await db().fetch(
        "SELECT direction,content,created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20",
        conversation_id,
    )


async def pause_for_payment(conversation_id: UUID, reason: str):
    await db().execute(
        """UPDATE conversations SET status='awaiting_payment_confirmation',ai_mode='paused',handoff_reason=$2,updated_at=now()
        WHERE id=$1""", conversation_id, reason,
    )
    await db().execute(
        "INSERT INTO audit_logs(company_id,entity_type,entity_id,action,details) SELECT company_id,'conversation',id,'payment_handoff',jsonb_build_object('reason',$2) FROM conversations WHERE id=$1",
        conversation_id, reason,
    )

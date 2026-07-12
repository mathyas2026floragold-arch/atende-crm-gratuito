CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE conversation_status AS ENUM ('new','in_progress','awaiting_customer','awaiting_payment_confirmation','resolved','cancelled');
CREATE TYPE ai_mode AS ENUM ('autonomous','assisted','triage','paused','human_exclusive');

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  ai_context text,
  access_url text,
  timezone text NOT NULL DEFAULT 'America/Fortaleza',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK(role IN ('admin','supervisor','agent','finance','marketing')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,email)
);

CREATE TABLE whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  instance_name text UNIQUE NOT NULL,
  phone text,
  provider text NOT NULL DEFAULT 'evolution_qr',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  email text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,phone)
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES whatsapp_connections(id),
  assigned_user_id uuid REFERENCES users(id),
  status conversation_status NOT NULL DEFAULT 'new',
  ai_mode ai_mode NOT NULL DEFAULT 'autonomous',
  handoff_reason text,
  payment_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  external_id text UNIQUE,
  direction text NOT NULL CHECK(direction IN ('in','out')),
  content text NOT NULL DEFAULT '',
  media_type text,
  media_url text,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  amount numeric(12,2),
  status text NOT NULL DEFAULT 'pending',
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_conversations_company_status ON conversations(company_id,status,updated_at DESC);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id,created_at);
CREATE INDEX idx_payments_company_status ON payments(company_id,status);

CREATE VIEW conversation_inbox AS
SELECT c.id,c.company_id,c.status,c.ai_mode,c.handoff_reason,c.updated_at,
       ct.name AS contact_name,ct.phone,w.instance_name,u.name AS assigned_user,
       (SELECT content FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_message
FROM conversations c
JOIN contacts ct ON ct.id=c.contact_id
JOIN whatsapp_connections w ON w.id=c.channel_id
LEFT JOIN users u ON u.id=c.assigned_user_id;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Registro inicial: edite depois no Supabase.
INSERT INTO companies(slug,name,ai_context,access_url)
VALUES('minha-empresa','Minha Empresa','Cadastre aqui produtos, preços, políticas e respostas autorizadas.',NULL);

INSERT INTO whatsapp_connections(company_id,instance_name)
SELECT id,'empresa-principal' FROM companies WHERE slug='minha-empresa';

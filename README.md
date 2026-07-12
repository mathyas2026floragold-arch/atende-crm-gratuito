# Atende CRM — Backend gratuito

Base funcional para conectar o Atende CRM ao WhatsApp com atendimento por IA e confirmação humana de Pix.

## Fluxo implementado

1. A Evolution API envia a mensagem do cliente para o webhook.
2. O sistema identifica a empresa, contato e conversa.
3. A IA atende normalmente e mantém o histórico.
4. Quando o cliente informa que pagou via Pix ou envia um comprovante, a IA é pausada.
5. A conversa entra na fila `awaiting_payment_confirmation`.
6. Um humano confere o Pix no CRM.
7. Ao confirmar, o backend envia o acesso cadastrado pelo WhatsApp.
8. Tudo fica registrado no histórico e na auditoria.

## Serviços gratuitos previstos

- Oracle Cloud Always Free: backend, Redis e Evolution API.
- Supabase Free: PostgreSQL e autenticação.
- Gemini API Free Tier: atendimento multimodal.
- Let’s Encrypt: HTTPS.
- Subdomínio gratuito: sem necessidade de comprar domínio no início.

## Início rápido

1. Copie `.env.example` para `.env`.
2. Preencha as chaves do Supabase, Gemini e Evolution API.
3. Execute `database/schema.sql` no SQL Editor do Supabase.
4. Execute `docker compose -f docker-compose.free.yml up -d --build`.
5. Configure na Evolution API o webhook `https://SEU-ENDERECO/webhooks/evolution/SEU_TOKEN`.

## Endpoints principais

- `GET /health`: estado do backend.
- `POST /webhooks/evolution/{token}`: recebe eventos do WhatsApp.
- `GET /api/conversations`: lista as conversas.
- `GET /api/conversations/{id}/messages`: histórico.
- `POST /api/conversations/{id}/confirm-payment`: confirmação humana e envio do acesso.
- `POST /api/conversations/{id}/resume-ai`: retoma atendimento automático.
- `GET /api/connections/qr`: solicita o QR Code real da Evolution API.

## Estado do projeto

O código está preparado para a infraestrutura real, mas só se conecta aos serviços externos depois que as respectivas credenciais forem inseridas no `.env`.

## GitHub

O projeto inclui um workflow de testes em `.github/workflows/tests.yml`. Consulte `deploy/GITHUB.md` para criar um repositório privado e enviar os arquivos pelo site do GitHub sem expor credenciais.

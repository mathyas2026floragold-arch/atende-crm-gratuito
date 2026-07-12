# Atende CRM

CRM genérico para atendimento no WhatsApp com IA e confirmação humana de Pix. Pode ser configurado para qualquer empresa.

## O que o sistema faz

- A IA responde mensagens do WhatsApp em português natural.
- O Gemini pode interpretar texto, imagem, áudio, documento e vídeo enviados em Base64.
- Quando o cliente diz que fez o Pix ou envia um comprovante, a IA pausa.
- A conversa aparece na fila **Conferir Pix**.
- Um humano confere o pagamento no banco.
- Ao clicar em **Confirmar Pix e enviar acesso**, o sistema envia o acesso cadastrado.
- O CRM mostra conversas, histórico, estado da IA, pagamentos e QR Code do WhatsApp.

> O sistema não consulta a conta bancária. A confirmação do Pix é obrigatoriamente humana.

## Pastas

```text
backend/                     API FastAPI e automação da IA
frontend/                    CRM web responsivo
database/schema.sql          Estrutura do banco Supabase
deploy/Caddyfile             HTTPS e proteção do painel
deploy/configure-evolution.sh Criação da instância e webhook
docker-compose.production.yml Sistema completo para a Oracle
GUIA_INSTALACAO_COMPLETO.md  Instruções para iniciantes
```

## Instalação

Leia [GUIA_INSTALACAO_COMPLETO.md](GUIA_INSTALACAO_COMPLETO.md). Ele explica, em ordem:

1. GitHub;
2. Supabase;
3. Gemini;
4. Oracle Cloud;
5. preenchimento do `.env`;
6. publicação com Docker;
7. conexão do WhatsApp por QR Code;
8. teste completo do atendimento.

## Desenvolvimento local

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Sem backend configurado, o frontend abre em modo demonstração. Na produção, o servidor do frontend encaminha `/api/crm/*` ao FastAPI e injeta o token no servidor, sem expor o segredo ao navegador.

## Testes

```bash
cd backend
python -m unittest discover -s tests -v
```

O workflow do GitHub também executa testes automaticamente.

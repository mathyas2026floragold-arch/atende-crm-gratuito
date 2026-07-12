# Publicação gratuita na Oracle Cloud

## 1. Criar a máquina

- Crie uma conta Oracle Cloud Free Tier.
- Escolha uma instância Ampere A1 Always Free quando houver capacidade.
- Use Ubuntu 22.04 ou mais recente.
- Abra as portas 22, 80 e 443 no firewall da Oracle.

## 2. Instalar Docker

Instale Docker Engine e o plugin Docker Compose usando a documentação oficial do Docker para Ubuntu.

## 3. Enviar o projeto

Envie esta pasta para um repositório GitHub privado e clone na máquina Oracle.

## 4. Configurar

```bash
cp .env.example .env
nano .env
```

Preencha DATABASE_URL, GEMINI_API_KEY, EVOLUTION_API_KEY e os tokens.

## 5. Banco Supabase

- Crie um projeto gratuito.
- Abra o SQL Editor.
- Execute `database/schema.sql`.
- Copie a Connection String para `DATABASE_URL`.

## 6. Subir backend

```bash
docker compose -f docker-compose.free.yml up -d --build
```

## 7. Evolution API

Instale a Evolution API em outro serviço Docker no mesmo servidor. Crie a instância com o mesmo nome de `EVOLUTION_INSTANCE`, escaneie o QR e aponte o webhook para:

```text
https://SEU-ENDERECO/webhooks/evolution/EVOLUTION_WEBHOOK_TOKEN
```

Ative pelo menos o evento `MESSAGES_UPSERT`.

Ative o envio de mídia em base64 no webhook da instância. Isso permite que a IA analise imagens, áudios, documentos e vídeos. Se essa opção não estiver disponível na versão instalada, implemente o download de mídia pelo endpoint correspondente da Evolution API antes de ativar o atendimento multimodal.

## 8. HTTPS gratuito

Use o proxy do EasyPanel ou Caddy com certificado Let’s Encrypt. Não exponha diretamente as portas internas do Redis ou banco.

## 9. Teste obrigatório

1. Envie mensagem comum e confirme resposta da IA.
2. Pergunte o preço do Pix e confirme que não ocorre transferência.
3. Envie “já fiz o Pix” e confirme que a IA pausa.
4. Confira o Pix no CRM.
5. Confirme e verifique se o acesso chega no WhatsApp.

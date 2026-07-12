# Resumo da publicação gratuita na Oracle

As instruções completas estão em `GUIA_INSTALACAO_COMPLETO.md` na raiz.

Resumo:

1. Crie uma VM Ubuntu dentro da cota Always Free.
2. Abra somente 22, 80 e 443.
3. Instale Docker Engine, Compose, Git, curl e jq.
4. Clone o repositório.
5. Copie `.env.example` para `.env` e preencha localmente.
6. Execute o SQL no Supabase.
7. Suba `docker-compose.production.yml`.
8. Execute `deploy/configure-evolution.sh`.
9. Abra o CRM, escaneie o QR e faça o teste completo.

Comando principal:

```bash
docker compose --env-file .env -f docker-compose.production.yml up -d --build
```

Não envie `.env` ao GitHub e não abra portas internas de banco, Redis, API ou frontend.

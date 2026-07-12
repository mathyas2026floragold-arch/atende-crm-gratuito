# GitHub do Atende CRM

Repositório: <https://github.com/mathyas2026floragold-arch/atende-crm-gratuito>

## Enviar pelo navegador

1. Extraia o ZIP.
2. Abra o repositório e clique em **Add file > Upload files**.
3. Arraste o conteúdo de dentro da pasta `atende-crm-gratuito`.
4. Confirme que `frontend`, `backend`, `.github` e `.env.example` aparecem.
5. Crie o commit.
6. Veja o resultado em **Actions**.

## Nunca enviar

- `.env`
- chaves do Gemini
- URI real do Supabase
- senha ou hash de login
- chave e token da Evolution API

O `.gitignore` bloqueia os arquivos mais comuns, mas sempre confira a lista antes do commit.

## Atualizar a Oracle

```bash
git pull
docker compose --env-file .env -f docker-compose.production.yml up -d --build
```

O GitHub armazena o código. A Oracle executa o sistema. Consulte `GUIA_INSTALACAO_COMPLETO.md` para a instalação completa.

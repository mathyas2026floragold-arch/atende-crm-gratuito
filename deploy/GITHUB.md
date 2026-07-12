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

## Atualizar o Northflank

Depois que o serviço combinado estiver ligado à branch `main`, cada commit aprovado é compilado e publicado automaticamente pelo Northflank.

Confirme que o GitHub contém `Dockerfile.northflank` e siga `GUIA_INSTALACAO_COMPLETO.md`.

## Alternativa Oracle

```bash
git pull
docker compose --env-file .env -f docker-compose.production.yml up -d --build
```

Os comandos Docker acima são apenas para quem escolher a Oracle. Na instalação recomendada, o GitHub armazena o código e o Northflank executa os serviços.

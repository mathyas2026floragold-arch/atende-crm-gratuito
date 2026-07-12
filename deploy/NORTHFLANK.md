# Northflank

O arquivo principal `GUIA_INSTALACAO_COMPLETO.md` contém a instalação detalhada no Northflank.

Arquitetura gratuita:

- 1 serviço combinado para frontend + FastAPI;
- 1 serviço de imagem externa para Evolution API;
- 1 PostgreSQL add-on para Evolution;
- Supabase externo para o CRM;
- domínio `code.run` com HTTPS automático.

Use `Dockerfile.northflank` no serviço combinado e copie as variáveis de `.env.northflank.example` para a área segura do Northflank.

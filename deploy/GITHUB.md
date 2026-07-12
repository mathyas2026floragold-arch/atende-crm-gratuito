# Como colocar o projeto no GitHub pelo site

## 1. Criar o repositório

1. Entre em `https://github.com/new`.
2. Nome sugerido: `atende-crm-gratuito`.
3. Selecione **Private** para manter a estrutura do sistema reservada.
4. Não marque README, `.gitignore` ou licença, pois o pacote já contém esses arquivos.
5. Clique em **Create repository**.

## 2. Enviar os arquivos

1. Extraia o ZIP no computador.
2. Abra a pasta `atende-crm-gratuito`.
3. No repositório vazio, clique em **uploading an existing file**.
4. Arraste o conteúdo de dentro da pasta, não a pasta externa do ZIP.
5. Confirme que aparecem `backend`, `database`, `deploy`, `.github`, `README.md` e `docker-compose.free.yml`.
6. Escreva `Primeira versão do Atende CRM` e clique em **Commit changes**.

## 3. O que nunca enviar

- Não renomeie `.env.example` para `.env` dentro do GitHub.
- Nunca envie chaves do Gemini, Evolution API, Supabase ou senhas.
- O arquivo `.gitignore` já bloqueia `.env` quando o projeto é utilizado com Git.

## 4. Testes automáticos

Depois do envio, abra a aba **Actions**. O workflow executará:

- Verificação do código Python;
- Testes do gatilho do Pix;
- Teste do webhook do WhatsApp;
- Validação do Docker Compose.

O ícone verde indica que a versão está aprovada.

## 5. Usar na Oracle

Na máquina Oracle, clone o repositório privado com uma chave de acesso ou token do GitHub. Depois:

```bash
cp .env.example .env
nano .env
docker compose -f docker-compose.free.yml up -d --build
```

Sempre que houver atualização:

```bash
git pull
docker compose -f docker-compose.free.yml up -d --build
```

## Observação

GitHub Pages não executa FastAPI, Redis nem Evolution API. O GitHub guarda o código; a Oracle Cloud executa os serviços 24 horas.

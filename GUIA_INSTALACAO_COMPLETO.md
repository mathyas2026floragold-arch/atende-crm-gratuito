# Guia completo — Atende CRM no Northflank

Este é o guia principal da versão Northflank. Faça as etapas na ordem e não coloque senhas ou chaves no GitHub.

## 1. Como a versão gratuita foi organizada

O plano Sandbox do Northflank informa atualmente:

- 2 serviços gratuitos sempre ligados;
- 1 banco gratuito;
- 2 cron jobs gratuitos;
- domínio `code.run` com HTTPS automático.

O projeto usa exatamente:

| Recurso | Onde fica |
|---|---|
| Frontend + backend FastAPI | serviço gratuito `atende-crm` |
| Evolution API | serviço privado gratuito `evolution-api` |
| Banco da Evolution | PostgreSQL gratuito `evolution-db` |
| Banco das conversas do CRM | Supabase Free externo |
| IA multimodal | Gemini API |
| Redis | dispensado nesta versão; o controle de mensagens usa memória local |

Fontes oficiais:

- Northflank Pricing: <https://northflank.com/pricing>
- Criar serviço pelo GitHub: <https://northflank.com/docs/v1/application/getting-started/build-and-deploy-your-code>
- Rodar imagem Docker: <https://northflank.com/docs/v1/application/run/run-an-image-from-a-container-registry>
- Portas e domínio gratuito: <https://northflank.com/docs/v1/application/network/configure-ports>
- Evolution API: <https://doc.evolution-api.com/v2/en/install/docker>

### Limite importante

O Sandbox é apropriado para começar e testar. A Evolution API pode consumir bastante memória. Se ela reiniciar por falta de memória, o plano gratuito da sua conta não será suficiente e será necessário aumentar somente o recurso dela.

Para permanecer 100% gratuito, esta primeira instalação não usa volume adicional. A documentação da Evolution recomenda persistir `/evolution/instances`. Sem volume, uma troca de contêiner pode exigir escanear o QR novamente. Um volume de 1 GB tem cobrança pequena conforme a tabela atual do Northflank, mas só adicione se aceitar essa cobrança.

## 2. O que você precisa criar

1. Conta no GitHub.
2. Conta gratuita no Supabase.
3. Chave no Google AI Studio.
4. Conta no Northflank conectada ao GitHub.

Repositório usado:

<https://github.com/mathyas2026floragold-arch/atende-crm-gratuito>

## 3. Atualizar o GitHub com esta versão

1. Baixe e extraia o ZIP `atende-crm-northflank-v3.zip`.
2. Entre no repositório pelo navegador.
3. Clique em **Add file** e **Upload files**.
4. Abra a pasta extraída `atende-crm-gratuito`.
5. Arraste o conteúdo de dentro dela para o GitHub.
6. Confirme principalmente estes arquivos:
   - `Dockerfile.northflank`
   - `.env.northflank.example`
   - `frontend`
   - `backend`
   - `database/schema.sql`
7. Escreva `Versão Northflank` e clique em **Commit changes**.
8. Abra **Actions** e aguarde os testes ficarem verdes.

Nunca envie um `.env` preenchido. As chaves serão colocadas diretamente na área segura do Northflank.

## 4. Preparar o Supabase do CRM

### 4.1 Criar o projeto

1. Abra <https://supabase.com/dashboard>.
2. Clique em **New project**.
3. Nome: `atende-crm`.
4. Crie e guarde uma senha forte para o banco.
5. Escolha a região mais próxima disponível.
6. Aguarde o projeto terminar de preparar.

### 4.2 Criar as tabelas

1. No Supabase, abra **SQL Editor**.
2. Clique em **New query**.
3. No GitHub, abra `database/schema.sql`.
4. Copie tudo, cole no SQL Editor e clique em **Run**.

### 4.3 Colocar os dados da sua empresa

Crie outra consulta e troque os textos antes de executar:

```sql
UPDATE companies
SET
  name = 'NOME DA SUA EMPRESA',
  ai_context = $$
Você atende clientes da NOME DA SUA EMPRESA.

Produtos e acessos:
- Produto A: R$ 00,00. Explique o acesso recebido.
- Produto B: R$ 00,00. Explique o acesso recebido.

Pagamento:
- Chave Pix: COLOQUE A CHAVE CORRETA.
- Nunca confirme pagamento.
- Quando o cliente disser que pagou, informe que a equipe fará a conferência.

Regras:
- Responda de forma natural, curta e em português.
- Faça uma pergunta por vez.
- Não invente preços, prazos ou políticas.
  $$,
  access_url = 'https://LINK-REAL-DO-ACESSO'
WHERE slug = 'minha-empresa';
```

Use **acesso**, não “aula”, nas informações fornecidas ao cliente.

### 4.4 Copiar a conexão

1. No topo do Supabase, clique em **Connect**.
2. Abra **Session pooler**.
3. Selecione **URI** e a porta `5432`.
4. Troque o marcador pela senha real.
5. Acrescente `?sslmode=require` ao final caso não exista.
6. Guarde a URI para `DATABASE_URL`.

Exemplo do formato:

```text
postgresql://postgres.PROJECT_REF:SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres?sslmode=require
```

## 5. Criar a chave do Gemini

1. Abra <https://aistudio.google.com/app/apikey>.
2. Clique em **Create API key**.
3. Copie a chave.
4. Guarde para `GEMINI_API_KEY`.

Não envie essa chave no GitHub ou em conversa.

## 6. Criar a conta e o projeto no Northflank

1. Abra <https://app.northflank.com/>.
2. Entre usando sua conta do GitHub.
3. Autorize o Northflank a acessar o repositório `atende-crm-gratuito`.
4. Clique em **Create project**.
5. Nome: `atende-crm`.
6. Escolha **Northflank Cloud**.
7. Escolha a região dos Estados Unidos mais próxima disponível, de preferência **US East**.
8. Confirme a criação.

No final, o projeto terá três itens: um banco e dois serviços.

## 7. Criar o PostgreSQL da Evolution

1. Dentro do projeto, clique em **Create new**.
2. Escolha **Addon**.
3. Escolha **PostgreSQL**.
4. Nome: `evolution-db`.
5. Versão: `15` ou uma versão estável disponível.
6. Em opções avançadas, nome do banco: `evolution`.
7. Não marque acesso público.
8. Escolha o recurso gratuito do Sandbox.
9. Clique em **Create addon**.
10. Aguarde o estado ficar `Running`.
11. Abra **Connection details**.
12. Copie a URI interna normal, não a URI de administração.

Essa URI será colocada em `DATABASE_CONNECTION_URI` no serviço da Evolution.

## 8. Criar o serviço da Evolution API

### 8.1 Criar o serviço

1. Clique em **Create new**.
2. Escolha **Service**.
3. Selecione **Deployment service** ou a opção de rodar uma imagem existente.
4. Nome: `evolution-api`.
5. Em imagem externa, coloque:

```text
atendai/evolution-api:v2.1.1
```

6. Clique em verificar a imagem.
7. Escolha o serviço gratuito do Sandbox.
8. Em **Ports**, crie ou confirme:
   - nome: `http`
   - porta interna: `8080`
   - protocolo: `HTTP`
   - público: `No`
9. Crie o serviço.

Ele pode aparecer com erro antes das variáveis serem preenchidas. Isso é esperado.

### 8.2 Endereço interno seguro

A Evolution não precisa ficar exposta na internet. Serviços no mesmo projeto Northflank se comunicam usando o nome do serviço e a porta. O endereço será:

```text
http://evolution-api:8080
```

Somente o CRM ficará público. Isso protege melhor a chave global da Evolution.

### 8.3 Variáveis da Evolution

Abra a área **Environment variables** ou **Runtime variables** e adicione:

| Nome | Valor |
|---|---|
| `SERVER_TYPE` | `http` |
| `SERVER_PORT` | `8080` |
| `SERVER_URL` | `http://evolution-api:8080` |
| `TELEMETRY` | `false` |
| `CORS_ORIGIN` | `*` |
| `CORS_METHODS` | `GET,POST,PUT,DELETE` |
| `CORS_CREDENTIALS` | `true` |
| `LOG_LEVEL` | `ERROR,WARN,INFO,LOG` |
| `DEL_INSTANCE` | `false` |
| `DATABASE_ENABLED` | `true` |
| `DATABASE_PROVIDER` | `postgresql` |
| `DATABASE_CONNECTION_URI` | URI interna copiada de `evolution-db` |
| `DATABASE_CONNECTION_CLIENT_NAME` | `evolution_northflank` |
| `DATABASE_SAVE_DATA_INSTANCE` | `true` |
| `DATABASE_SAVE_DATA_NEW_MESSAGE` | `false` |
| `DATABASE_SAVE_MESSAGE_UPDATE` | `false` |
| `DATABASE_SAVE_DATA_CONTACTS` | `false` |
| `DATABASE_SAVE_DATA_CHATS` | `false` |
| `DATABASE_SAVE_DATA_LABELS` | `false` |
| `DATABASE_SAVE_DATA_HISTORIC` | `false` |
| `CACHE_REDIS_ENABLED` | `false` |
| `CACHE_LOCAL_ENABLED` | `true` |
| `QRCODE_LIMIT` | `30` |
| `QRCODE_COLOR` | `#6757D9` |
| `CONFIG_SESSION_PHONE_CLIENT` | `Atende CRM` |
| `CONFIG_SESSION_PHONE_NAME` | `Chrome` |
| `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES` | `false` |
| `LANGUAGE` | `pt-BR` |

Crie uma chave aleatória longa, com pelo menos 40 caracteres, e adicione:

| Nome | Valor |
|---|---|
| `AUTHENTICATION_API_KEY` | chave aleatória da Evolution |

Guarde essa chave. O mesmo valor será usado em `EVOLUTION_API_KEY` no CRM.

Salve as variáveis e reinicie/redeploy o serviço. Abra **Logs** e confirme que não aparece erro contínuo de banco ou falta de memória.

## 9. Criar o serviço do Atende CRM

### 9.1 Criar pelo GitHub

1. Clique em **Create new**.
2. Escolha **Service**.
3. Selecione **Combined service**.
4. Nome: `atende-crm`.
5. Selecione o repositório `mathyas2026floragold-arch/atende-crm-gratuito`.
6. Branch: `main`.
7. Método de construção: **Dockerfile**.
8. Contexto de construção: raiz do repositório, normalmente `/` ou `.`.
9. Caminho do Dockerfile:

```text
/Dockerfile.northflank
```

10. Escolha o serviço gratuito do Sandbox.
11. Em portas, confirme:
    - nome: `http`
    - porta interna: `8080`
    - protocolo: `HTTP`
    - público: `Yes`
12. Crie o serviço e aguarde a compilação.

O Northflank compila frontend e backend juntos e faz deploy automático quando o GitHub recebe um novo commit.

### 9.2 Copiar o endereço

Em **Ports & DNS**, copie o endereço parecido com:

```text
https://http--atende-crm--xxxxxxxx.code.run
```

Chame esse endereço de `URL_CRM`.

## 10. Variáveis do Atende CRM

Abra as variáveis de execução do serviço `atende-crm` e preencha:

| Nome | Valor |
|---|---|
| `APP_ENV` | `production` |
| `APP_SECRET` | outra chave aleatória longa |
| `PUBLIC_URL` | `URL_CRM` completa |
| `FRONTEND_URL` | a mesma `URL_CRM` |
| `DATABASE_URL` | Session pooler 5432 do Supabase com SSL |
| `REDIS_URL` | deixe vazio |
| `CRM_ADMIN_USER` | `admin` ou outro usuário |
| `CRM_ADMIN_PASSWORD` | senha forte para entrar no painel |
| `EVOLUTION_BASE_URL` | `http://evolution-api:8080` |
| `EVOLUTION_API_KEY` | mesma chave de `AUTHENTICATION_API_KEY` |
| `EVOLUTION_INSTANCE` | `empresa-principal` |
| `EVOLUTION_WEBHOOK_TOKEN` | outro token aleatório longo |
| `GEMINI_API_KEY` | chave do Google AI Studio |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `AI_ENABLED` | `true` |
| `AI_DEBOUNCE_SECONDS` | `8` |
| `DEFAULT_COMPANY_SLUG` | `minha-empresa` |
| `DEFAULT_COMPANY_NAME` | nome da empresa |
| `DEFAULT_ACCESS_MESSAGE` | `Pagamento confirmado! Aqui está o seu acesso: {access_url}` |

Marque como segredo, quando o Northflank oferecer essa opção:

- `APP_SECRET`
- `DATABASE_URL`
- `CRM_ADMIN_PASSWORD`
- `EVOLUTION_API_KEY`
- `EVOLUTION_WEBHOOK_TOKEN`
- `GEMINI_API_KEY`

Salve e faça **Restart** ou **Redeploy**.

## 11. Conferir se os serviços estão online

Abra no navegador:

```text
URL_CRM/health
```

O resultado deve conter:

```json
{"online":true,"service":"atende-crm-api","environment":"production"}
```

Depois abra apenas `URL_CRM`. O navegador pedirá usuário e senha. Use `CRM_ADMIN_USER` e `CRM_ADMIN_PASSWORD`.

O painel deve mostrar **AO VIVO**. Se mostrar **PRÉVIA**, o frontend abriu, mas o backend não conseguiu consultar o Supabase.

## 12. Preparar e conectar o WhatsApp

1. Entre no CRM.
2. Abra **Conexão WhatsApp**.
3. Clique em **Preparar conexão**.
4. O backend criará a instância e o webhook automaticamente.
5. Clique em **Atualizar QR Code**.
6. No celular comercial, abra WhatsApp > **Aparelhos conectados** > **Conectar aparelho**.
7. Escaneie o QR.
8. Atualize até aparecer conectado.

O webhook configurado será:

```text
URL_CRM/webhooks/evolution/EVOLUTION_WEBHOOK_TOKEN
```

## 13. Testar o atendimento completo

Use outro celular.

### Teste comum

Envie:

```text
Olá, como funciona o acesso?
```

A IA deve responder usando o contexto do Supabase.

### Teste de pergunta sobre Pix

Envie:

```text
Qual é o valor e como faço o Pix?
```

Não deve chamar o humano porque o cliente ainda não informou que pagou.

### Teste de pagamento informado

Envie:

```text
Pronto, já fiz o Pix. Segue o comprovante.
```

A IA deve pausar e a conversa deve aparecer em **Conferir Pix**.

### Confirmação humana

1. Confira o pagamento diretamente no banco.
2. Abra a conversa no CRM.
3. Clique em **Confirmar Pix e enviar acesso**.
4. Confirme a pergunta de segurança.
5. Confira se o acesso chegou ao WhatsApp.

O sistema não verifica saldo bancário. Nunca libere acesso apenas pela imagem do comprovante.

## 14. Diagnóstico de erros

### Build do CRM falhou

Confira se o GitHub contém `Dockerfile.northflank`, `frontend/package-lock.json`, `frontend/src` e `backend/app`.

### CRM abre, mas mostra PRÉVIA

Confira nos logs do `atende-crm`:

- `DATABASE_URL` correta;
- senha do Supabase codificada na URI se tiver caractere especial;
- `sslmode=require`;
- SQL executado.

### Evolution fica reiniciando

Abra os logs e procure:

- erro de `DATABASE_CONNECTION_URI`;
- variável ausente;
- `Out of memory`, `OOM` ou `Killed`.

Se for memória, a Evolution excedeu o recurso gratuito e precisará de um plano com mais memória.

### QR some depois de atualização

Sem volume persistente, uma substituição do contêiner pode apagar arquivos locais da sessão. Clique novamente em **Preparar conexão** e escaneie o QR. Para maior estabilidade, adicione um volume de 1 GB em `/evolution/instances`, sabendo que há cobrança de armazenamento.

### Gemini retorna erro 429

O limite gratuito foi atingido. Aguarde a renovação ou consulte o uso no Google AI Studio.

## 15. Atualizações automáticas

O serviço combinado possui CI/CD. Quando uma atualização for enviada à branch `main`, o Northflank compila e publica a nova versão do CRM automaticamente.

O serviço da Evolution usa imagem externa e não precisa ser reconstruído a cada atualização do CRM.

## 16. Checklist

- [ ] Nova versão enviada ao GitHub.
- [ ] SQL executado no Supabase.
- [ ] Empresa, contexto e link de acesso cadastrados.
- [ ] Gemini configurado.
- [ ] Projeto Northflank criado.
- [ ] PostgreSQL `evolution-db` em execução.
- [ ] Evolution com porta 8080 pública e variáveis preenchidas.
- [ ] CRM criado usando `Dockerfile.northflank`.
- [ ] Variáveis do CRM preenchidas.
- [ ] `URL_CRM/health` online.
- [ ] Login do painel funcionando.
- [ ] Botão **Preparar conexão** concluído.
- [ ] QR escaneado.
- [ ] IA respondendo mensagem comum.
- [ ] “Já fiz o Pix” pausando a IA.
- [ ] Humano conferindo o banco.
- [ ] Acesso enviado após confirmação.

Quando todos os itens estiverem marcados, o sistema estará pronto para uso inicial no Northflank.

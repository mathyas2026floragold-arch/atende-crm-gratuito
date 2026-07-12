# Guia completo — Atende CRM online e gratuito

Este manual foi escrito para quem nunca publicou um sistema. Faça as etapas na ordem. Não envie senhas, chaves ou tokens em conversa, WhatsApp ou GitHub.

## 1. O que ficará online

Ao terminar, você terá três endereços:

| Endereço | Função |
|---|---|
| `https://crm.SEU-DOMINIO` | painel do Atende CRM, protegido por usuário e senha |
| `https://api.SEU-DOMINIO` | backend que recebe o webhook do WhatsApp |
| `https://evo.SEU-DOMINIO` | Evolution API usada para conectar o número |

O fluxo será:

1. O cliente envia uma mensagem no WhatsApp.
2. A Evolution API entrega a mensagem ao FastAPI.
3. O Gemini responde usando o contexto cadastrado para a empresa.
4. Se o cliente disser que já fez o Pix ou enviar um comprovante, a IA pausa.
5. Um humano abre a conversa no CRM e confere o pagamento diretamente no banco.
6. O humano clica em **Confirmar Pix e enviar acesso**.
7. O sistema envia o link de acesso pelo WhatsApp e registra a operação.

O código suporta uma empresa e uma instância de WhatsApp prontas para uso. O banco já possui `company_id` para evolução futura, mas várias empresas simultâneas exigem uma instância e configuração separadas para cada número.

## 2. Contas necessárias

Crie estas contas:

- GitHub: guarda o código. Seu repositório já é `mathyas2026floragold-arch/atende-crm-gratuito`.
- Supabase: banco PostgreSQL gratuito.
- Google AI Studio: chave gratuita do Gemini.
- Oracle Cloud Free Tier: servidor que executará o sistema.

Os planos gratuitos têm limites e podem mudar. A Oracle pode pedir cartão para confirmar identidade, e uma região pode ficar temporariamente sem máquina gratuita disponível. Consulte sempre as páginas oficiais:

- Oracle Free Tier: <https://www.oracle.com/cloud/free/>
- Supabase Pricing: <https://supabase.com/pricing>
- Gemini Pricing: <https://ai.google.dev/gemini-api/docs/pricing>
- Evolution API com Docker: <https://doc.evolution-api.com/v2/en/install/docker>

## 3. Colocar esta versão no GitHub

1. Baixe e extraia o ZIP deste projeto no computador.
2. Entre em <https://github.com/mathyas2026floragold-arch/atende-crm-gratuito>.
3. Clique em **Add file** e depois em **Upload files**.
4. Abra a pasta extraída `atende-crm-gratuito`.
5. Arraste **o conteúdo de dentro dela** para a área de upload.
6. Confirme que aparecem `backend`, `frontend`, `database`, `deploy`, `.github`, `.env.example`, `docker-compose.production.yml` e este guia.
7. Escreva `Versão completa com frontend` no campo da alteração.
8. Clique em **Commit changes**.
9. Abra a aba **Actions** e aguarde o teste ficar verde.

Não crie nem envie um arquivo chamado `.env` ao GitHub. O `.env.example` é apenas um modelo sem credenciais reais.

## 4. Criar o banco no Supabase

### 4.1 Criar o projeto e as tabelas

1. Entre em <https://supabase.com/dashboard>.
2. Clique em **New project**.
3. Nome: `atende-crm`.
4. Crie uma senha forte em **Database Password** e guarde-a.
5. Escolha uma região próxima e crie o projeto.
6. Quando terminar, abra **SQL Editor** e clique em **New query**.
7. No GitHub, abra `database/schema.sql`.
8. Copie todo o conteúdo, cole no SQL Editor e clique em **Run**.

O script cria as tabelas, índices, caixa de entrada e uma empresa inicial. O link de acesso começa vazio por segurança.

### 4.2 Cadastrar empresa, contexto e acesso

No SQL Editor, execute a consulta abaixo após trocar os dados:

```sql
UPDATE companies
SET
  name = 'NOME DA SUA EMPRESA',
  ai_context = $$
Você atende clientes da NOME DA SUA EMPRESA.

Produtos e acessos:
- Produto A: R$ 00,00. Explique o que o cliente recebe.
- Produto B: R$ 00,00. Explique o que o cliente recebe.

Pagamento:
- Chave Pix: COLOQUE A CHAVE CORRETA.
- Nunca diga que o pagamento foi confirmado.
- Quando o cliente disser que pagou, informe que a equipe fará a conferência.

Regras:
- Responda com mensagens curtas e naturais.
- Faça uma pergunta de cada vez.
- Não invente preços, prazos ou políticas.
  $$,
  access_url = 'https://LINK-REAL-DO-ACESSO'
WHERE slug = 'minha-empresa';
```

Use a palavra **acesso** nas mensagens ao cliente. O link deve ser o endereço enviado depois da confirmação humana.

### 4.3 Copiar a conexão correta

1. No topo do projeto, clique em **Connect**.
2. Procure **Session pooler** e selecione o formato **URI**.
3. Use a conexão da porta `5432`, parecida com:

```text
postgresql://postgres.PROJECT_REF:SUA_SENHA@aws-0-REGIAO.pooler.supabase.com:5432/postgres
```

4. Troque o marcador pela senha real.
5. Acrescente `?sslmode=require` ao final, se ainda não existir.
6. Guarde a URI para usar em `DATABASE_URL`.

Para um backend persistente em IPv4, use o Session pooler da porta 5432. Documentação: <https://supabase.com/docs/guides/database/connecting-to-postgres>.

## 5. Criar a chave do Gemini

1. Entre em <https://aistudio.google.com/app/apikey>.
2. Clique em **Create API key**.
3. Se solicitado, escolha ou crie um projeto do Google Cloud.
4. Copie a chave e guarde. Ela será `GEMINI_API_KEY`.
5. Não cole essa chave no GitHub nem a envie para outra pessoa.

O projeto usa `gemini-2.5-flash`. Mídias em Base64 são analisadas dentro dos limites da API. Arquivos grandes podem exigir o fluxo de arquivos do Gemini: <https://ai.google.dev/gemini-api/docs/generate-content/image-understanding>.

## 6. Criar o servidor gratuito na Oracle

### 6.1 Criar a máquina

1. Entre em <https://cloud.oracle.com/>.
2. Abra **Compute** > **Instances** > **Create instance**.
3. Nome: `atende-crm`.
4. Imagem: Ubuntu 22.04 ou 24.04.
5. Em **Shape**, procure uma opção **Always Free eligible**. Quando disponível, use `VM.Standard.A1.Flex`.
6. Uma configuração de 2 OCPUs e 12 GB é suficiente, desde que o resumo mostre que está dentro da cota gratuita.
7. Marque a atribuição de **Public IPv4 address**.
8. Gere e baixe a chave SSH privada. Guarde o arquivo.
9. Crie a instância.

Se faltar capacidade, tente outra zona ou outro horário. Não selecione uma opção paga sem conferir o resumo de custo.

### 6.2 Abrir somente as portas necessárias

Na VCN/sub-rede da máquina, crie regras de entrada TCP:

| Porta | Uso |
|---:|---|
| 22 | acesso SSH |
| 80 | emissão e redirecionamento HTTPS |
| 443 | CRM, API e Evolution com HTTPS |

Não abra 5432, 6379, 8000, 8080 ou 3000. Elas ficam na rede interna do Docker.

## 7. Entrar no servidor pelo Windows

Copie o IP público da instância. No PowerShell, troque o caminho e o IP:

```powershell
ssh -i "C:\Users\SEU_USUARIO\Downloads\ssh-key.key" ubuntu@IP_PUBLICO
```

Na primeira conexão, digite `yes`.

## 8. Instalar Docker e ferramentas

Cole no terminal da Oracle:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git jq
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

Depois:

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
exit
```

Entre novamente por SSH e confirme:

```bash
docker --version
docker compose version
```

## 9. Baixar o projeto na Oracle

Como o repositório está público:

```bash
git clone https://github.com/mathyas2026floragold-arch/atende-crm-gratuito.git
cd atende-crm-gratuito
ls frontend
```

O último comando deve mostrar `package.json`, `Dockerfile`, `server.mjs` e `src`.

## 10. Criar e preencher o `.env`

### 10.1 Montar o domínio gratuito

Troque os pontos do IP por hífens e acrescente `.sslip.io`:

```text
IP: 129.146.50.10
BASE_DOMAIN: 129-146-50-10.sslip.io
CRM: https://crm.129-146-50-10.sslip.io
```

### 10.2 Gerar os segredos

Execute quatro vezes e guarde cada resultado:

```bash
openssl rand -hex 32
```

Use resultados diferentes em `APP_SECRET`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_TOKEN` e `EVOLUTION_DB_PASSWORD`. O formato hexadecimal evita caracteres que quebrariam a URI interna do PostgreSQL.

### 10.3 Gerar o hash da senha do painel

```bash
docker run --rm -it caddy:2-alpine caddy hash-password
```

Digite a senha que usará para entrar no CRM. Nada aparece enquanto você digita. Copie o resultado que começa com `$2`.

### 10.4 Editar o arquivo

```bash
cp .env.example .env
nano .env
```

Preencha:

| Variável | Valor |
|---|---|
| `BASE_DOMAIN` | domínio feito com o IP e `sslip.io` |
| `PUBLIC_URL` | `https://api.BASE_DOMAIN` usando o domínio real |
| `FRONTEND_URL` | `https://crm.BASE_DOMAIN` usando o domínio real |
| `APP_SECRET` | primeiro resultado aleatório |
| `CRM_ADMIN_USER` | nome de login, como `admin` |
| `CRM_ADMIN_PASSWORD_HASH` | hash do Caddy entre aspas simples |
| `DATABASE_URL` | URI Session pooler 5432 do Supabase |
| `EVOLUTION_API_KEY` | segundo resultado aleatório |
| `EVOLUTION_INSTANCE` | mantenha `empresa-principal` |
| `EVOLUTION_WEBHOOK_TOKEN` | terceiro resultado aleatório |
| `EVOLUTION_DB_PASSWORD` | quarto resultado aleatório |
| `GEMINI_API_KEY` | chave do Google AI Studio |
| `GEMINI_MODEL` | mantenha `gemini-2.5-flash` |

Exemplo apenas do formato:

```dotenv
BASE_DOMAIN=129-146-50-10.sslip.io
PUBLIC_URL=https://api.129-146-50-10.sslip.io
FRONTEND_URL=https://crm.129-146-50-10.sslip.io
APP_SECRET=uma_chave_aleatoria_longa
CRM_ADMIN_USER=admin
CRM_ADMIN_PASSWORD_HASH='$2a$14$HASH_COMPLETO_GERADO_PELO_CADDY'
DATABASE_URL=postgresql://postgres.abc:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require
EVOLUTION_API_KEY=outra_chave_aleatoria
EVOLUTION_INSTANCE=empresa-principal
EVOLUTION_WEBHOOK_TOKEN=outro_token_aleatorio
EVOLUTION_DB_PASSWORD=senha_forte_do_banco_local
GEMINI_API_KEY=chave_do_google_ai_studio
```

As aspas simples do hash são importantes porque ele contém `$`. No nano: `Ctrl+O`, `Enter`, `Ctrl+X`.

Proteja o arquivo:

```bash
chmod 600 .env
```

## 11. Subir o sistema completo

Valide primeiro:

```bash
docker compose --env-file .env -f docker-compose.production.yml config >/dev/null
```

Se não houver erro:

```bash
docker compose --env-file .env -f docker-compose.production.yml up -d --build
docker compose --env-file .env -f docker-compose.production.yml ps
```

Devem aparecer `api`, `frontend`, `evolution`, `evolution-db`, `redis` e `caddy` ativos.

Teste, trocando o domínio:

```bash
curl https://api.SEU_BASE_DOMAIN/health
```

O retorno esperado contém `"online":true`.

## 12. Criar a instância e o webhook

```bash
chmod +x deploy/configure-evolution.sh
./deploy/configure-evolution.sh
```

O script cria a instância `empresa-principal`, usa `WHATSAPP-BAILEYS`, ativa `MESSAGES_UPSERT`, habilita mídia em Base64 e configura o webhook secreto.

Se a instância já existir, a criação pode avisar. O importante é o webhook concluir.

## 13. Abrir o CRM e conectar o número

1. Abra `https://crm.SEU_BASE_DOMAIN`.
2. Use `CRM_ADMIN_USER` e a senha original usada para gerar o hash.
3. Abra **Conexão WhatsApp**.
4. No celular comercial: WhatsApp > **Aparelhos conectados** > **Conectar aparelho**.
5. Escaneie o QR Code.
6. Atualize até aparecer conectado.

## 14. Teste obrigatório

Use outro celular para falar com o número conectado.

1. Envie `Olá, como funciona o acesso?`. A IA deve responder conforme o contexto.
2. Envie `Qual é o valor e como faço o Pix?`. Isso não deve chamar o humano, pois a pessoa ainda não pagou.
3. Envie `Pronto, já fiz o Pix.`. A IA deve pausar e a conversa deve entrar em **Conferir Pix**.
4. Entre no banco e confira valor, nome e entrada real do Pix.
5. No CRM, clique em **Confirmar Pix e enviar acesso**.
6. Confirme se o acesso correto chegou ao WhatsApp do cliente.

Nunca confirme apenas olhando a imagem. Um comprovante pode ser falso; ele serve para chamar um humano.

## 15. Atualizar no futuro

```bash
cd ~/atende-crm-gratuito
git pull
docker compose --env-file .env -f docker-compose.production.yml up -d --build
```

O `.env` fica somente no servidor.

## 16. Diagnóstico

Estado:

```bash
docker compose --env-file .env -f docker-compose.production.yml ps
```

Logs gerais:

```bash
docker compose --env-file .env -f docker-compose.production.yml logs --tail=150
```

Logs específicos:

```bash
docker compose --env-file .env -f docker-compose.production.yml logs --tail=150 api
docker compose --env-file .env -f docker-compose.production.yml logs --tail=150 frontend
docker compose --env-file .env -f docker-compose.production.yml logs --tail=150 evolution
docker compose --env-file .env -f docker-compose.production.yml logs --tail=150 caddy
```

### CRM mostra “PRÉVIA”

O frontend abriu, mas não consultou o backend. Confira `api`, `APP_SECRET`, os logs, o SQL do Supabase e a `DATABASE_URL` com `sslmode=require`.

### WhatsApp não responde

Confira a conexão, o nome `empresa-principal`, o webhook, logs de `evolution` e `api`, e a chave do Gemini.

### Gemini retorna 429

O plano gratuito possui cota. Aguarde a renovação ou consulte o uso no Google AI Studio.

### HTTPS não abre

Confira portas 80/443, o IP em `BASE_DOMAIN` e os logs do Caddy.

## 17. Segurança e limites

- GitHub guarda o código, mas não executa FastAPI, Redis ou Evolution.
- O painel usa HTTPS e senha do Caddy.
- O token da API fica no servidor do frontend, não no navegador.
- Redis e bancos locais não têm portas públicas.
- A IA nunca confirma o Pix.
- Um humano sempre confere o banco e autoriza o acesso.
- A Evolution usa uma conexão não oficial com o WhatsApp. Mudanças podem exigir atualização. Para grande escala ou garantia oficial, planeje WhatsApp Cloud API.
- Serviços gratuitos possuem cotas, inatividade, disponibilidade regional e políticas que podem mudar.

## 18. Checklist final

- [ ] Frontend e backend completos no GitHub.
- [ ] `.env` não está no GitHub.
- [ ] SQL executado no Supabase.
- [ ] Empresa, contexto e link de acesso cadastrados.
- [ ] Session pooler 5432 com SSL no `.env`.
- [ ] Gemini configurado.
- [ ] Portas 22, 80 e 443 abertas.
- [ ] Seis serviços Docker ativos.
- [ ] Webhook configurado.
- [ ] QR escaneado com número comercial.
- [ ] Mensagem comum respondida pela IA.
- [ ] “Já fiz o Pix” pausa a IA.
- [ ] Humano confere o banco.
- [ ] Confirmação envia o acesso correto.

Quando todos os itens estiverem marcados, o Atende CRM estará pronto para atendimento real.

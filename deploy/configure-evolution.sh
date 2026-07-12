#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Arquivo $ENV_FILE não encontrado. Copie .env.example para .env primeiro."
  exit 1
fi

read_value() {
  key="$1"
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  value="$(printf '%s' "$value" | sed 's/^"//;s/"$//')"
  if [ -z "$value" ]; then
    echo "A variável $key está vazia no $ENV_FILE." >&2
    exit 1
  fi
  printf '%s' "$value"
}

BASE_DOMAIN="$(read_value BASE_DOMAIN)"
API_KEY="$(read_value EVOLUTION_API_KEY)"
INSTANCE="$(read_value EVOLUTION_INSTANCE)"
WEBHOOK_TOKEN="$(read_value EVOLUTION_WEBHOOK_TOKEN)"
EVOLUTION_URL="https://evo.${BASE_DOMAIN}"
WEBHOOK_URL="https://api.${BASE_DOMAIN}/webhooks/evolution/${WEBHOOK_TOKEN}"

echo "Criando ou conferindo a instância $INSTANCE..."
CREATE_PAYLOAD="$(jq -n --arg name "$INSTANCE" '{instanceName:$name,integration:"WHATSAPP-BAILEYS",qrcode:true}')"
CREATE_RESPONSE="$(curl -sS -w '\n%{http_code}' -X POST "${EVOLUTION_URL}/instance/create" \
  -H "apikey: ${API_KEY}" -H "Content-Type: application/json" -d "$CREATE_PAYLOAD")"
CREATE_CODE="$(printf '%s' "$CREATE_RESPONSE" | tail -n 1)"
if [ "$CREATE_CODE" -lt 200 ] || [ "$CREATE_CODE" -ge 500 ]; then
  echo "A Evolution respondeu HTTP $CREATE_CODE ao criar a instância. Confira os logs."
fi

echo "Configurando o webhook..."
WEBHOOK_PAYLOAD="$(jq -n --arg url "$WEBHOOK_URL" '{webhook:{enabled:true,url:$url,webhook_by_events:false,webhook_base64:true,events:["MESSAGES_UPSERT"]}}')"
curl -fsS -X POST "${EVOLUTION_URL}/webhook/set/${INSTANCE}" \
  -H "apikey: ${API_KEY}" -H "Content-Type: application/json" -d "$WEBHOOK_PAYLOAD" >/dev/null

echo "Webhook configurado com sucesso."
echo "Abra https://crm.${BASE_DOMAIN} e use a área Conexão WhatsApp para escanear o QR Code."

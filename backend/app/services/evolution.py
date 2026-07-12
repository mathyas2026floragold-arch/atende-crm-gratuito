import httpx
from ..config import get_settings


class EvolutionClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def headers(self) -> dict[str, str]:
        return {"apikey": self.settings.evolution_api_key, "Content-Type": "application/json"}

    async def send_text(self, phone: str, text: str) -> dict:
        url = f"{self.settings.evolution_base_url}/message/sendText/{self.settings.evolution_instance}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=self.headers, json={"number": phone, "text": text})
            response.raise_for_status()
            return response.json()

    async def typing(self, phone: str, seconds: int = 2) -> None:
        url = f"{self.settings.evolution_base_url}/chat/sendPresence/{self.settings.evolution_instance}"
        payload = {"number": phone, "presence": "composing", "delay": seconds * 1000}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()

    async def connection_state(self) -> dict:
        url = f"{self.settings.evolution_base_url}/instance/connectionState/{self.settings.evolution_instance}"
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def qr_code(self) -> dict:
        url = f"{self.settings.evolution_base_url}/instance/connect/{self.settings.evolution_instance}"
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def setup_instance(self) -> dict:
        base_url = self.settings.evolution_base_url.rstrip("/")
        public_url = self.settings.public_url.rstrip("/")
        instance = self.settings.evolution_instance
        create_payload = {
            "instanceName": instance,
            "integration": "WHATSAPP-BAILEYS",
            "qrcode": True,
        }
        webhook_payload = {
            "webhook": {
                "enabled": True,
                "url": f"{public_url}/webhooks/evolution/{self.settings.evolution_webhook_token}",
                "webhook_by_events": False,
                "webhook_base64": True,
                "events": ["MESSAGES_UPSERT"],
            }
        }
        async with httpx.AsyncClient(timeout=45) as client:
            created = await client.post(
                f"{base_url}/instance/create", headers=self.headers, json=create_payload
            )
            if created.status_code >= 500:
                created.raise_for_status()
            webhook = await client.post(
                f"{base_url}/webhook/set/{instance}", headers=self.headers, json=webhook_payload
            )
            webhook.raise_for_status()
        return {
            "ok": True,
            "instance": instance,
            "webhook_configured": True,
            "instance_created": 200 <= created.status_code < 300,
        }

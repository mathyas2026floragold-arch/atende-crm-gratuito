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

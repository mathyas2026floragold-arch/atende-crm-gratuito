import httpx
from ..config import get_settings


SYSTEM_PROMPT = """Você integra a equipe de atendimento da empresa.
Converse em português brasileiro natural, com mensagens curtas e uma pergunta por vez.
Use apenas produtos, preços, políticas e respostas fornecidas no contexto da empresa.
Nunca diga que é uma IA. Nunca invente informação.
Não confirme pagamentos e não libere acessos.
Quando o cliente disser que pagou ou enviar comprovante, informe que a equipe fará a conferência e encerre sua atuação nessa conversa.
Se não tiver certeza, diga que vai verificar com a equipe.
"""


class GeminiClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @staticmethod
    def _clean_base64(value: str | None) -> str | None:
        """Evolution pode devolver base64 puro ou uma data URL completa."""
        if not value:
            return None
        if value.startswith("data:") and "," in value:
            return value.split(",", 1)[1]
        return value

    async def answer(self, message: str, history: list[dict], company_context: str, media_base64: str | None = None, mime_type: str | None = None) -> str:
        if not self.settings.gemini_api_key:
            return self.demo_answer(message)
        history_text = "\n".join(
            f"{'Cliente' if item.get('direction') == 'in' else 'Empresa'}: {item.get('content', '')}"
            for item in history[-12:]
        )
        prompt = f"{SYSTEM_PROMPT}\n\nCONTEXTO DA EMPRESA:\n{company_context}\n\nHISTÓRICO:\n{history_text}\n\nCLIENTE: {message}"
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent?key={self.settings.gemini_api_key}"
        )
        parts = [{"text": prompt}]
        media_base64 = self._clean_base64(media_base64)
        if media_base64 and mime_type:
            parts.append({"inline_data": {"mime_type": mime_type, "data": media_base64}})
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.45, "maxOutputTokens": 220},
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    async def is_payment_proof(self, media_base64: str | None, mime_type: str | None) -> bool:
        media_base64 = self._clean_base64(media_base64)
        if not media_base64 or not mime_type or not self.settings.gemini_api_key:
            return False
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.settings.gemini_model}:generateContent?key={self.settings.gemini_api_key}"
        )
        payload = {"contents": [{"parts": [
            {"text": "Esta mídia é claramente um comprovante de pagamento ou Pix? Responda somente SIM ou NAO. Não suponha se não estiver legível."},
            {"inline_data": {"mime_type": mime_type, "data": media_base64}},
        ]}]}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip().upper()
        return text.startswith("SIM")

    @staticmethod
    def demo_answer(message: str) -> str:
        text = message.lower()
        if "preço" in text or "valor" in text:
            return "Claro. Qual produto ou opção você quer consultar?"
        if "como funciona" in text:
            return "Eu te explico. Primeiro, me diz exatamente o que você está procurando?"
        return "Entendi. Me conta só mais um detalhe para eu conseguir te orientar corretamente."

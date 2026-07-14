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


class GeminiServiceError(RuntimeError):
    """Erro seguro para interface e logs, sem URL ou chave da API."""


def _safe_gemini_error(response: httpx.Response) -> GeminiServiceError:
    if response.status_code in {401, 403}:
        return GeminiServiceError("A chave do Gemini foi recusada. Gere uma chave válida no Google AI Studio.")
    if response.status_code == 404:
        return GeminiServiceError("Modelo não encontrado para esta chave. Confirme a GEMINI_API_KEY do Google AI Studio e o GEMINI_MODEL.")
    if response.status_code == 429:
        return GeminiServiceError("Limite de uso do Gemini atingido. Verifique a cota do projeto.")
    return GeminiServiceError(f"O Gemini respondeu com erro HTTP {response.status_code}.")


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
            raise RuntimeError("GEMINI_API_KEY não configurada")
        history_text = "\n".join(
            f"{'Cliente' if item.get('direction') == 'in' else 'Empresa'}: {item.get('content', '')}"
            for item in history[-12:]
        )
        prompt = f"{SYSTEM_PROMPT}\n\nCONTEXTO DA EMPRESA:\n{company_context}\n\nHISTÓRICO:\n{history_text}\n\nCLIENTE: {message}"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent"
        parts = [{"text": prompt}]
        media_base64 = self._clean_base64(media_base64)
        if media_base64 and mime_type:
            parts.append({"inline_data": {"mime_type": mime_type, "data": media_base64}})
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.45, "maxOutputTokens": 220},
        }
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, headers={"x-goog-api-key": self.settings.gemini_api_key}, json=payload)
            if not response.is_success:
                raise _safe_gemini_error(response)
            data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    async def is_payment_proof(self, media_base64: str | None, mime_type: str | None) -> bool:
        media_base64 = self._clean_base64(media_base64)
        if not media_base64 or not mime_type or not self.settings.gemini_api_key:
            return False
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.settings.gemini_model}:generateContent"
        payload = {"contents": [{"parts": [
            {"text": "Esta mídia é claramente um comprovante de pagamento ou Pix? Responda somente SIM ou NAO. Não suponha se não estiver legível."},
            {"inline_data": {"mime_type": mime_type, "data": media_base64}},
        ]}]}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(url, headers={"x-goog-api-key": self.settings.gemini_api_key}, json=payload)
            if not response.is_success:
                raise _safe_gemini_error(response)
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

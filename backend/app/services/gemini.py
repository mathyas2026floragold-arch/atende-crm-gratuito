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

    @staticmethod
    def _output_text(data: dict) -> str:
        texts = [
            content.get("text", "")
            for step in data.get("steps", []) if step.get("type") == "model_output"
            for content in step.get("content", []) if content.get("type") == "text"
        ]
        answer = "\n".join(text.strip() for text in texts if text.strip()).strip()
        if not answer:
            raise GeminiServiceError("O Gemini não retornou uma resposta em texto.")
        return answer

    async def _interaction(self, text: str, media_base64: str | None = None, mime_type: str | None = None) -> str:
        model = self.settings.gemini_model
        # Alias da API legada; a API Interactions usa o identificador estável atual.
        if model == "gemini-flash-latest":
            model = "gemini-3.5-flash"
        inputs: list[dict] = [{"type": "text", "text": text}]
        media_base64 = self._clean_base64(media_base64)
        if media_base64 and mime_type:
            media_type = (
                "image" if mime_type.startswith("image/") else
                "audio" if mime_type.startswith("audio/") else
                "video" if mime_type.startswith("video/") else "document"
            )
            inputs.append({"type": media_type, "data": media_base64, "mime_type": mime_type})
        payload = {
            "model": model,
            "input": inputs,
            "system_instruction": SYSTEM_PROMPT,
            "store": False,
            "generation_config": {"temperature": 0.45, "max_output_tokens": 220},
        }
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={"x-goog-api-key": self.settings.gemini_api_key}, json=payload,
            )
            if not response.is_success:
                raise _safe_gemini_error(response)
            return self._output_text(response.json())

    async def answer(self, message: str, history: list[dict], company_context: str, media_base64: str | None = None, mime_type: str | None = None) -> str:
        if not self.settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY não configurada")
        history_text = "\n".join(
            f"{'Cliente' if item.get('direction') == 'in' else 'Empresa'}: {item.get('content', '')}"
            for item in history[-12:]
        )
        prompt = f"CONTEXTO DA EMPRESA:\n{company_context}\n\nHISTÓRICO:\n{history_text}\n\nCLIENTE: {message}"
        return await self._interaction(prompt, media_base64, mime_type)

    async def is_payment_proof(self, media_base64: str | None, mime_type: str | None) -> bool:
        media_base64 = self._clean_base64(media_base64)
        if not media_base64 or not mime_type or not self.settings.gemini_api_key:
            return False
        text = (await self._interaction(
            "Esta mídia é claramente um comprovante de pagamento ou Pix? Responda somente SIM ou NAO. Não suponha se não estiver legível.",
            media_base64, mime_type,
        )).strip().upper()
        return text.startswith("SIM")

    @staticmethod
    def demo_answer(message: str) -> str:
        text = message.lower()
        if "preço" in text or "valor" in text:
            return "Claro. Qual produto ou opção você quer consultar?"
        if "como funciona" in text:
            return "Eu te explico. Primeiro, me diz exatamente o que você está procurando?"
        return "Entendi. Me conta só mais um detalhe para eu conseguir te orientar corretamente."

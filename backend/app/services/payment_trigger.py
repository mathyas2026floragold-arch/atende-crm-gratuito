import re
from dataclasses import dataclass


PAYMENT_PATTERNS = [
    r"\b(j[aá]\s+)?(fiz|mandei|enviei|realizei|efetuei|paguei)\b.{0,35}\b(pix|pagamento|transfer[eê]ncia)\b",
    r"\b(pix|pagamento|transfer[eê]ncia)\b.{0,35}\b(feito|realizado|efetuado|pago|enviado)\b",
    r"\b(comprovante|recibo)\b.{0,30}\b(pix|pagamento|enviei|mandei|segue)\b",
]


@dataclass(frozen=True)
class PaymentDetection:
    triggered: bool
    reason: str | None = None
    confidence: float = 0.0


def detect_payment_claim(text: str | None, media_type: str | None = None, caption: str | None = None) -> PaymentDetection:
    combined = " ".join(x for x in [text, caption] if x).lower().strip()
    for pattern in PAYMENT_PATTERNS:
        if re.search(pattern, combined, flags=re.IGNORECASE | re.DOTALL):
            return PaymentDetection(True, "payment_language", 0.96)

    proof_words = ("comprovante", "pix", "pagamento", "paguei", "transferência", "transferencia")
    if media_type in {"image", "document"} and any(word in combined for word in proof_words):
        return PaymentDetection(True, "payment_proof_media", 0.92)

    return PaymentDetection(False)

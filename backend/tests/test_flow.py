import unittest
from app.services.payment_trigger import detect_payment_claim
from app.services.event_parser import extract_event


class PaymentTriggerTests(unittest.TestCase):
    def test_detects_pix_paid(self):
        self.assertTrue(detect_payment_claim("Pronto, já fiz o Pix").triggered)

    def test_detects_proof_caption(self):
        result = detect_payment_claim("segue o comprovante do pix", "image")
        self.assertTrue(result.triggered)

    def test_does_not_trigger_price_question(self):
        self.assertFalse(detect_payment_claim("Qual é o valor do Pix?").triggered)

    def test_does_not_trigger_future_intention(self):
        self.assertFalse(detect_payment_claim("Vou fazer o Pix depois").triggered)


class WebhookParsingTests(unittest.TestCase):
    def test_extracts_text_message(self):
        payload = {"event":"messages.upsert","instance":"empresa-principal","data":{"key":{"fromMe":False,"remoteJid":"5584999999999@s.whatsapp.net","id":"MSG1"},"pushName":"Cliente","message":{"conversation":"Olá"}}}
        event = extract_event(payload)
        self.assertEqual(event["phone"], "5584999999999")
        self.assertEqual(event["text"], "Olá")


if __name__ == "__main__":
    unittest.main()

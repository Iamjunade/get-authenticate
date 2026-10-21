import os
import time
import base64
import json
from typing import Dict, Any, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

# Master app-level key (loaded from secure secret/env)
MASTER_KEY = os.getenv("BIOMETRIC_APP_SECRET_KEY", "b3a7c6f092e48102a9b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5")

class RollingTokenCrypto:
    def __init__(self, master_hex_key: str = MASTER_KEY):
        self.master_key = bytes.fromhex(master_hex_key)
        self.processed_nonces = set() # Replay attack cache (in prod: Redis with TTL)

    def derive_rolling_key(self, rolling_timestamp_ms: int, session_id: str) -> bytes:
        """
        Derives an ephemeral AES-256 key matching the client-side rolling token formula:
        KDF(master_key, salt=session_id, info=floor(ts / 30000ms))
        Allows a 30-second rolling token window to tolerate slight clock drift.
        """
        window = rolling_timestamp_ms // 30000
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=session_id.encode('utf-8'),
            info=str(window).encode('utf-8'),
        )
        return hkdf.derive(self.master_key)

    def decrypt_payload(
        self,
        session_id: str,
        ciphertext_b64: str,
        iv_b64: str,
        tag_b64: str,
        rolling_timestamp_ms: int
    ) -> Dict[str, Any]:
        """
        Decrypts AES-256-GCM payload and checks replay & expiration.
        """
        now_ms = int(time.time() * 1000)
        # Check token expiration / clock skew (+/- 45 seconds tolerance)
        if abs(now_ms - rolling_timestamp_ms) > 45000:
            raise ValueError("Biometric rolling token timestamp out of tolerance window.")

        # Replay prevention
        nonce_signature = f"{session_id}:{rolling_timestamp_ms}:{iv_b64}"
        if nonce_signature in self.processed_nonces:
            raise ValueError("Replay attack detected: Payload nonce already processed.")
        self.processed_nonces.add(nonce_signature)

        key = self.derive_rolling_key(rolling_timestamp_ms, session_id)
        aesgcm = AESGCM(key)

        ciphertext = base64.b64decode(ciphertext_b64)
        iv = base64.b64decode(iv_b64)
        tag = base64.b64decode(tag_b64)

        # AESGCM in cryptography expects ciphertext + tag combined
        data_to_decrypt = ciphertext + tag
        associated_data = session_id.encode('utf-8')

        decrypted_bytes = aesgcm.decrypt(iv, data_to_decrypt, associated_data)
        return json.loads(decrypted_bytes.decode('utf-8'))

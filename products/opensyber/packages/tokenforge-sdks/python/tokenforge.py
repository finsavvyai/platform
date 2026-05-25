"""TokenForge Python SDK — Device-bound ECDSA P-256 session security."""

import base64
import hashlib
import json
import os
import time
import uuid
from pathlib import Path
from typing import Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils
import requests

API_BASE = "https://tokenforge-api.opensyber.cloud"
BIND_ENDPOINT = "/v1/bind"


class TokenForge:
    """Device-bound session SDK using ECDSA P-256 signatures."""

    def __init__(
        self,
        api_key: str,
        session_id: Optional[str] = None,
        key_path: Optional[str] = None,
    ):
        self.api_key = api_key
        self.session_id = session_id or str(uuid.uuid4())
        self.device_id = str(uuid.uuid4())
        self._key_path = key_path
        self._private_key: Optional[ec.EllipticCurvePrivateKey] = None
        self._load_or_generate_key()

    def _load_or_generate_key(self) -> None:
        if self._key_path and Path(self._key_path).exists():
            pem = Path(self._key_path).read_bytes()
            self._private_key = serialization.load_pem_private_key(pem, password=None)
            return
        self._private_key = ec.generate_private_key(ec.SECP256R1())
        if self._key_path:
            Path(self._key_path).parent.mkdir(parents=True, exist_ok=True)
            pem = self._private_key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
            Path(self._key_path).write_bytes(pem)

    def _public_key_pem(self) -> str:
        return self._private_key.public_key().public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode()

    def _sign(self, payload: str) -> str:
        digest = hashlib.sha256(payload.encode()).digest()
        sig = self._private_key.sign(digest, ec.ECDSA(utils.Prehashed(hashes.SHA256())))
        return base64.b64encode(sig).decode()

    def get_headers(self) -> dict[str, str]:
        """Return signed headers for the current session."""
        nonce = uuid.uuid4().hex
        timestamp = str(int(time.time()))
        payload = f"{self.session_id}:{nonce}:{timestamp}"
        signature = self._sign(payload)
        return {
            "X-TF-Signature": signature,
            "X-TF-Nonce": nonce,
            "X-TF-Timestamp": timestamp,
            "X-TF-Device-ID": self.device_id,
            "Authorization": f"Bearer {self.api_key}",
        }

    def sign_request(self, method: str, url: str, headers: Optional[dict] = None) -> dict:
        """Sign a request and return merged headers."""
        merged = dict(headers or {})
        merged.update(self.get_headers())
        return merged

    def bind(self) -> dict:
        """Register this device with the TokenForge API."""
        url = f"{API_BASE}{BIND_ENDPOINT}"
        body = {
            "deviceId": self.device_id,
            "sessionId": self.session_id,
            "publicKey": self._public_key_pem(),
        }
        resp = requests.post(url, json=body, headers=self.get_headers(), timeout=10)
        resp.raise_for_status()
        return resp.json()

    def session(self) -> requests.Session:
        """Return a requests.Session that auto-signs every request."""
        s = requests.Session()
        outer = self

        class _SignAdapter(requests.adapters.HTTPAdapter):
            def send(self, request, *args, **kwargs):
                for k, v in outer.get_headers().items():
                    request.headers[k] = v
                return super().send(request, *args, **kwargs)

        s.mount("https://", _SignAdapter())
        s.mount("http://", _SignAdapter())
        return s

    def httpx_client(self):
        """Return an httpx.Client with auto-signing via event hooks."""
        import httpx

        outer = self

        def _sign_event(request: httpx.Request) -> None:
            for k, v in outer.get_headers().items():
                request.headers[k] = v

        return httpx.Client(event_hooks={"request": [_sign_event]})


if __name__ == "__main__":
    tf = TokenForge(api_key="tf_demo_key")
    print(f"Device ID: {tf.device_id}")
    print(f"Session ID: {tf.session_id}")
    print("Signed headers:", json.dumps(tf.get_headers(), indent=2))
    print("\nTo bind: tf.bind()")
    print("Auto-signing session: s = tf.session(); s.get('https://api.example.com')")

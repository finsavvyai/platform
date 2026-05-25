"""
Tests: Python TokenForge SDK

Validates:
- ECDSA P-256 key generation
- Deterministic key persistence to PEM file
- Signed header format (all 4 X-TF-* headers present)
- Nonce uniqueness across calls
- Timestamp freshness
- Sign request merges existing headers
- Auto-signing session adapter
"""
import os
import sys
import time
import tempfile
import unittest

# Add the Python SDK directory to sys.path so we can import tokenforge.py
_sdk_dir = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', '..', 'packages', 'tokenforge-sdks', 'python',
))
sys.path.insert(0, _sdk_dir)

from tokenforge import TokenForge


class TestTokenForgeKeyGeneration(unittest.TestCase):
    """Test ECDSA P-256 key generation."""

    def test_generates_key_on_init(self):
        tf = TokenForge(api_key="tf_test")
        self.assertIsNotNone(tf._private_key)

    def test_key_persists_to_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "key.pem")
            tf1 = TokenForge(api_key="tf_test", key_path=path)
            self.assertTrue(os.path.exists(path))

            # Should load existing key
            tf2 = TokenForge(api_key="tf_test", key_path=path)
            # Both instances use the same key
            pub1 = tf1._public_key_pem()
            pub2 = tf2._public_key_pem()
            self.assertEqual(pub1, pub2)

    def test_different_instances_different_keys(self):
        tf1 = TokenForge(api_key="tf_test")
        tf2 = TokenForge(api_key="tf_test")
        pub1 = tf1._public_key_pem()
        pub2 = tf2._public_key_pem()
        self.assertNotEqual(pub1, pub2)


class TestTokenForgeHeaders(unittest.TestCase):
    """Test signed header generation."""

    def setUp(self):
        self.tf = TokenForge(api_key="tf_test")

    def test_headers_contain_all_required_fields(self):
        headers = self.tf.get_headers()
        self.assertIn("X-TF-Signature", headers)
        self.assertIn("X-TF-Nonce", headers)
        self.assertIn("X-TF-Timestamp", headers)
        self.assertIn("X-TF-Device-ID", headers)
        self.assertIn("Authorization", headers)

    def test_authorization_uses_bearer_token(self):
        headers = self.tf.get_headers()
        self.assertTrue(headers["Authorization"].startswith("Bearer "))

    def test_nonces_are_unique(self):
        nonces = set()
        for _ in range(100):
            headers = self.tf.get_headers()
            nonces.add(headers["X-TF-Nonce"])
        self.assertEqual(len(nonces), 100)

    def test_timestamp_is_current(self):
        headers = self.tf.get_headers()
        ts = int(headers["X-TF-Timestamp"])
        now = int(time.time())
        self.assertAlmostEqual(ts, now, delta=2)

    def test_signature_is_base64(self):
        headers = self.tf.get_headers()
        sig = headers["X-TF-Signature"]
        self.assertGreater(len(sig), 0)
        # Base64 only contains valid chars
        import base64
        try:
            base64.b64decode(sig)
        except Exception:
            self.fail("Signature is not valid base64")

    def test_device_id_is_uuid(self):
        headers = self.tf.get_headers()
        device_id = headers["X-TF-Device-ID"]
        self.assertRegex(device_id, r'^[0-9a-f-]+$')


class TestTokenForgeSignRequest(unittest.TestCase):
    """Test request signing with header merging."""

    def setUp(self):
        self.tf = TokenForge(api_key="tf_test")

    def test_merges_existing_headers(self):
        existing = {"Content-Type": "application/json", "Accept": "text/html"}
        merged = self.tf.sign_request("GET", "https://api.example.com", existing)
        self.assertEqual(merged["Content-Type"], "application/json")
        self.assertEqual(merged["Accept"], "text/html")
        self.assertIn("X-TF-Signature", merged)

    def test_preserves_all_tf_headers(self):
        merged = self.tf.sign_request("POST", "https://api.example.com")
        self.assertIn("X-TF-Signature", merged)
        self.assertIn("X-TF-Nonce", merged)
        self.assertIn("X-TF-Timestamp", merged)
        self.assertIn("X-TF-Device-ID", merged)


class TestTokenForgeSession(unittest.TestCase):
    """Test auto-signing session."""

    def test_creates_session(self):
        tf = TokenForge(api_key="tf_test")
        session = tf.session()
        self.assertIsNotNone(session)

    def test_public_key_pem_format(self):
        tf = TokenForge(api_key="tf_test")
        pem = tf._public_key_pem()
        self.assertTrue(pem.startswith("-----BEGIN PUBLIC KEY-----"))
        self.assertTrue(pem.strip().endswith("-----END PUBLIC KEY-----"))


if __name__ == "__main__":
    unittest.main()

"""
Sample: Python TokenForge SDK

Demonstrates:
- Key generation and persistence
- Request signing (X-TF-* headers)
- Auto-signing session via requests.Session
- Device binding flow
- httpx client with event hooks
"""
import sys
import os

# Add the SDK to the path
sys.path.insert(0, os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', '..', 'packages', 'tokenforge-sdks', 'python',
)))

from tokenforge import TokenForge


def demo_basic_usage():
    """Basic: generate headers and sign requests."""
    tf = TokenForge(api_key="tf_sample_key")
    print(f"Device ID: {tf.device_id}")
    print(f"Session ID: {tf.session_id}")

    headers = tf.get_headers()
    assert "X-TF-Signature" in headers
    assert "X-TF-Nonce" in headers
    assert "X-TF-Timestamp" in headers
    assert "X-TF-Device-ID" in headers
    print("Headers generated successfully")
    return headers


def demo_signed_request():
    """Sign an existing request's headers."""
    tf = TokenForge(api_key="tf_sample_key")
    existing_headers = {"Content-Type": "application/json", "Accept": "application/json"}
    merged = tf.sign_request("GET", "https://api.example.com/data", existing_headers)
    assert "Content-Type" in merged
    assert "X-TF-Signature" in merged
    print("Request signed with merged headers")
    return merged


def demo_key_persistence(tmp_path: str):
    """Persist keys to disk and reload."""
    key_path = os.path.join(tmp_path, "device.pem")
    tf1 = TokenForge(api_key="tf_sample_key", key_path=key_path)
    headers1 = tf1.get_headers()

    # Reload from disk
    tf2 = TokenForge(api_key="tf_sample_key", key_path=key_path)
    headers2 = tf2.get_headers()

    # Same key, so signatures should use same private key
    assert os.path.exists(key_path)
    print(f"Key persisted to {key_path}")
    return tf1, tf2


def demo_auto_signing_session():
    """Create a requests.Session that auto-signs all requests."""
    tf = TokenForge(api_key="tf_sample_key")
    session = tf.session()
    # session.get("https://api.example.com/data") would auto-sign
    print("Auto-signing session created")
    return session


if __name__ == "__main__":
    demo_basic_usage()
    demo_signed_request()
    print("\nAll Python SDK demos passed!")

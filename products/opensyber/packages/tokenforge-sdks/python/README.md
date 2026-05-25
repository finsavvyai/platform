# TokenForge Python SDK

Device-bound ECDSA P-256 session security for Python. Built for AI agents and backend services.

## Install

```bash
pip install tokenforge

# With httpx support
pip install tokenforge[httpx]
```

## Quick Start

```python
from tokenforge import TokenForge

tf = TokenForge(api_key="tf_your_api_key")
tf.bind()  # Register device with TokenForge API
```

## AI Agent Usage

```python
from tokenforge import TokenForge

# Ephemeral agent — keys live in memory
tf = TokenForge(api_key="tf_your_api_key")
tf.bind()

# Auto-signing requests.Session
session = tf.session()
response = session.get("https://api.example.com/data")
# All requests include X-TF-Signature, X-TF-Nonce, X-TF-Timestamp, X-TF-Device-ID

# Or with httpx
client = tf.httpx_client()
response = client.get("https://api.example.com/data")
```

## Persistent Key Storage

```python
# For long-running services — key persists across restarts
tf = TokenForge(
    api_key="tf_your_api_key",
    key_path="~/.tokenforge/key.pem"
)
```

## Manual Header Signing

```python
headers = tf.sign_request("GET", "https://api.example.com/data")
# Returns dict with X-TF-Signature, X-TF-Nonce, X-TF-Timestamp, X-TF-Device-ID
```

## How It Works

1. Generates an ECDSA P-256 keypair using the `cryptography` library
2. Signs every request with `{sessionId}:{nonce}:{timestamp}` payload
3. Registers the device public key via `POST /v1/bind`
4. Server verifies signatures to ensure device binding

## API

| Method | Description |
|--------|-------------|
| `TokenForge(api_key, session_id?, key_path?)` | Create client |
| `bind()` | Register device with API |
| `get_headers()` | Get signed headers dict |
| `sign_request(method, url, headers?)` | Sign and merge headers |
| `session()` | Auto-signing `requests.Session` |
| `httpx_client()` | Auto-signing `httpx.Client` |

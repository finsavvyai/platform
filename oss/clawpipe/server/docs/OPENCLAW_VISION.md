# OpenCLaw Vision Integration

## Overview

OpenCLaw vision integration enables FinSavvyAI to process multimodal requests containing both text and images. When a request includes image content, it is automatically routed to the OpenCLaw backend for cloud-based visual analysis.

## Features

- **Automatic Vision Detection**: Worker node detects image content in requests
- **Multimodal Support**: Handles mixed text and image content
- **OpenAI-Compatible Format**: Supports standard OpenAI vision message format
- **GLM-4V Format Support**: Also supports GLM-4V image format
- **Streaming and Non-Streaming**: Both response modes supported
- **Longer Timeouts**: Vision requests use 60s timeout (vs 30s for text)

## Configuration

Enable OpenCLaw vision support by setting environment variables:

```bash
export OPENCLAW_ENABLED=true
export OPENCLAW_URL=http://localhost:11434
export OPENCLAW_API_KEY=your-api-key-here  # Optional
```

## API Usage

### Vision Request Format

Send requests with multimodal content using the OpenAI-compatible format:

```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4-vision-preview",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What'\''s in this image?"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
            }
          }
        ]
      }
    ],
    "max_tokens": 300
  }'
```

### GLM-4V Format

Alternative format using GLM-4V style:

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "Describe this image"},
        {"type": "image", "image": "base64_encoded_image_data"}
      ]
    }
  ]
}
```

### Streaming Vision Requests

Enable streaming for real-time vision responses:

```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4-vision-preview",
    "stream": true,
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "Analyze this chart"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
        ]
      }
    ]
  }'
```

## Response Format

### Non-Streaming Response

```json
{
  "id": "chatcmpl-1234567890-abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4-vision-preview",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The image shows a bar chart with..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 50,
    "total_tokens": 200
  },
  "worker_info": {
    "node_id": "worker-abc123",
    "backend": "openclaw",
    "backend_type": "vision",
    "openclaw_url": "http://localhost:11434"
  }
}
```

### Streaming Response

Server-Sent Events (SSE) format:

```
data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"The"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" image"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{"content":" shows"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","choices":[{"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

## Capabilities Endpoint

Check if vision is available via the health endpoint:

```bash
curl http://localhost:8001/health
```

Response with vision enabled:

```json
{
  "status": "healthy",
  "capabilities": {
    "vision": true,
    "streaming": true,
    "multimodal": true
  },
  "openclaw": {
    "enabled": true,
    "available": true,
    "url": "http://localhost:11434",
    "supports_vision": true
  }
}
```

## Image Specifications

- **Format**: JPEG, PNG (via base64 data URL)
- **Max Size**: 10MB per image
- **Encoding**: base64
- **URL Format**: `data:image/<type>;base64,<data>`

## Routing Behavior

1. **Vision Request Detected**: Worker checks for image content
2. **OpenCLaw Availability Checked**: If OpenCLaw is enabled and available
3. **Route to OpenCLaw**: Request forwarded to OpenCLaw vision API
4. **Fallback**: If OpenCLaw unavailable, returns 503 error

## Backend Selection

Force OpenCLaw backend for vision:

```json
{
  "messages": [...],
  "backend": "openclaw"
}
```

Or use:

```json
{
  "messages": [...],
  "use_openclaw": true
}
```

## Error Handling

### Vision Unavailable (503)

```json
{
  "error": "Vision unavailable",
  "message": "OpenCLaw backend is required for vision but is not available"
}
```

### OpenCLaw Timeout (504)

```json
{
  "error": "OpenCLaw timeout",
  "message": "OpenCLaw vision did not respond in time"
}
```

### OpenCLaw Error (502)

```json
{
  "error": "OpenCLaw vision inference failed",
  "message": "Details about the error"
}
```

## Testing

### Python Test Script

```python
import asyncio
import base64
import aiohttp

async def test_vision():
    # Read and encode image
    with open("test_image.jpg", "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")
        image_url = f"data:image/jpeg;base64,{image_data}"

    # Send vision request
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "http://localhost:8001/v1/chat/completions",
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "Describe this image"},
                            {"type": "image_url", "image_url": {"url": image_url}}
                        ]
                    }
                ]
            }
        ) as response:
            result = await response.json()
            print(result["choices"][0]["message"]["content"])

asyncio.run(test_vision())
```

## Implementation Details

### OpenCLaw Client (`src/core/openclaw_client.py`)

- `complete_vision()`: Non-streaming vision completions
- `stream_chat_vision()`: Streaming vision completions
- `_contains_image()`: Detects image content in messages
- `_has_vision_content()`: Checks message list for images
- `_prepare_vision_messages()`: Transforms messages to OpenCLaw format

### Worker Node (`src/workers/worker_node.py`)

- `_detect_vision_content()`: Detects vision requests
- `_openclaw_vision_complete_response()`: Handles non-streaming vision
- `_openclaw_vision_stream_response()`: Handles streaming vision
- Health/status endpoints report vision capability

### Tests (`tests/unit/test_openclaw_vision.py`)

13 unit tests covering:
- OpenAI format image detection
- GLM-4V format image detection
- Text-only message handling
- Message preparation
- Worker node vision routing

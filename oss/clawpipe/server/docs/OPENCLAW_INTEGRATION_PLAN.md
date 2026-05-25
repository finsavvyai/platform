# OpenCLaw Integration Plan

## Overview
Integration of OpenCLaw API into FinSavvyAI for hybrid inference routing with fallback capability.

## Components

### 1. OpenCLaw Client (src/core/openclaw_client.py)
- Already implemented and tested
- Contains: OpenCLawClient class with async methods for completions/chat
- Handles authentication, request headers, health checks
- File: src/core/openclaw_client.py
- Tests: tests/unit/test_openclaw_client.py

### 2. Hybrid Router (src/core/hybrid_router.py)
- Already implemented
- Routes based on task type detection to optimal backend
- Routes: code→local, writing→OpenCLaw, analysis→OpenCLaw, chat→local, vision→OpenCLaw
- File: src/core/hybrid_router.py

### 3. Configuration
- Add environment variables for OpenCLaw integration
- Config settings:
  - OPENCLAW_ENABLED=true
  - OPENCLAW_URL=http://localhost:11434
  - OPENCLAW_API_KEY=your-api-key-here

### 4. Worker Node Enhancement (src/workers/worker_node.py)
- Add OpenCLaw support for optional inference
- Priority: HIGH - determines when to use OpenCLaw
- Implementation:
  - Import openclaw_client
  - Update message handling to check OpenCLaw_ENABLED flag
  - Call OpenCLaw for chat completions if enabled
  - Fall back to local inference engine if OpenCLaw is disabled or unavailable

### 5. Tests (tests/unit/test_openclaw_client.py)
- Verify OpenCLaw client can be imported
- Test basic functionality (init, headers, health check)
- Future: Expand test coverage

### 6. Documentation Updates
- docs/OPENCLAW_INTEGRATION.md - Already created
- docs/README.md - Link to OpenCLaw integration guide
- docs/API_VERSIONING.md - Versioning strategy
- docs/RELEASE_NOTES_1_0_0.md - Release notes
- docs/FEATURES_HIGHLIGHT.md - Feature comparison

### 7. Git Commit
- Add all new files
- Create comprehensive commit message

## Implementation Steps

#### Step 1: Update Worker Configuration
File: src/workers/worker_node.py

Changes required:
- Add `openclaw_enabled` flag to WorkerConfig
- Import openclaw_client
- Add OpenCLaw client initialization
- Implement fallback logic for OpenCLaw in chat completion handler
- Update health endpoint for OpenCLaw status

Pseudo-code:
```python
# In __init__
    self.openclaw_enabled = os.environ.get('OPENCLAW_ENABLED', 'false').lower() == 'true'

if self.openclaw_enabled:
    from openclaw_client import OpenCLawClient
else:
    from openclaw_client import OpenCLawClientMock()  # Or use a mock

# In _handle_chat_completion
    if self.openclaw_enabled:
        response = await self.openclaw_client.complete(...)
    else:
        response_text = await self.engine.complete(...)
```

#### Step 2: Update Tests
File: tests/unit/test_openclaw_client.py

Changes required:
- Add import test for OpenCLawClient
- Update tests for basic functionality
- Add test for OpenCLaw completion handling

Pseudo-code:
```python
import sys
sys.path.insert(0, '../..')
from src.core.openclaw_client import OpenCLawClient

def test_init():
    client = OpenCLawClient()
    print('PASS: OpenCLaw_client imported successfully')
    sys.exit(0)
def test_complete():
    result = client.complete('test prompt')
    assert 'choices' in result
    sys.exit(0)
```

#### Step 3: Update Documentation
Files: docs/OPENCLAW_INTEGRATION.md, docs/README.md

Changes required:
- Add note about environment variable config
- Add note about fallback to local inference
- Update README.md to reference OpenCLaw documentation

Pseudo-code:
```markdown
## Environment Variables

Set these variables to enable OpenCLaw integration:

\`\`\`bash
export OPENCLAW_ENABLED=true
export OPENCLAW_URL=http://localhost:11434
export OPENCLAW_API_KEY=your-api-key-here

\`\`\`

## Fallback Strategy

When OpenCLaw is enabled and available, requests are routed to it.
If OpenCLaw is unavailable or disabled, the system uses the local llama-cpp-python engine.

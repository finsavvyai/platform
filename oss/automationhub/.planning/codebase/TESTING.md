# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- Use `pytest` as the primary runner.
- Root config is in `pyproject.toml` (`[tool.pytest.ini_options]`) with `testpaths = ["tests"]`.
- Backend-specific config is in `backend/pytest.ini` for `backend/tests`.

**Assertion Library:**
- Use built-in `pytest` assertions and `pytest.raises`.

**Run Commands:**
```bash
pytest
pytest -v
pytest --cov=src/automationhub --cov-report=term-missing --cov-fail-under=95
pytest --cov=app --cov-report=term-missing --cov-report=html:htmlcov --cov-report=xml
```

## Test File Organization

**Location:**
- Place core app tests in `tests/` (`tests/test_workflows.py`, `tests/test_api.py`, `tests/test_scheduler.py`).
- Place backend service/API tests in `backend/tests/` (`backend/tests/test_auth_service.py`, `backend/tests/test_gateway.py`, `backend/tests/test_integrations.py`).

**Naming:**
- Use `test_*.py` for test files.
- Use `Test*` classes and `test_*` methods.

**Structure:**
```
tests/
  conftest.py
  test_*.py
backend/tests/
  conftest.py
  test_*.py
```

## Test Structure

**Suite Organization:**
```typescript
class TestWorkflow:
    def test_activate_requires_steps(self):
        wf = Workflow("Test", "Test")
        with pytest.raises(ValueError):
            wf.activate()

    @pytest.mark.asyncio
    async def test_execute_workflow(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        result = await wf.execute()
        assert result["status"] == "success"
```

**Patterns:**
- **Setup pattern:** build fixtures for services, entities, and sample payload dictionaries in each test module.
- **Teardown pattern:** clean up dependency overrides and temporary files with `finally` or fixture scope cleanup (`backend/tests/conftest.py`, `tests/test_document_processor.py`).
- **Assertion pattern:** assert key response/data fields and state transitions, not full snapshots.

## Mocking

**Framework:** `unittest.mock` (`Mock`, `MagicMock`, `AsyncMock`, `patch`, `patch.object`)

**Patterns:**
```typescript
with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
    with patch('app.services.auth_service.verify_password') as mock_verify:
        mock_get_user.return_value = test_user
        mock_verify.return_value = True
        result = await auth_service.authenticate_user(mock_db, login_request)
        assert result.success is True
```

**What to Mock:**
- External boundaries: SMTP, HTTP clients, Cloudflare API calls, MCP service calls, and database session behavior (`backend/tests/test_auth_service.py`, `backend/tests/test_cloudflare_service.py`, `tests/test_workflow_executor.py`).
- FastAPI dependency behavior via overrides/fixtures (`backend/tests/conftest.py`).

**What NOT to Mock:**
- Core deterministic domain logic in `src/automationhub` modules; instantiate real objects and assert behavior directly (`tests/test_actions.py`, `tests/test_workflows.py`, `tests/test_scheduler.py`).

## Fixtures and Factories

**Test Data:**
```typescript
@pytest.fixture
def sample_provider_data(self):
    return {
        "name": "Test Cloudflare Account",
        "api_token": "test_api_token_123",
        "email": "test@example.com",
    }
```

**Location:**
- Shared fixtures in `tests/conftest.py` and `backend/tests/conftest.py`.
- Module-local data builders in individual test files (especially backend suites).

## Coverage

**Requirements:** 
- Root tests enforce `--cov-fail-under=95` for `src/automationhub` (from `pyproject.toml`).
- Backend tests collect coverage for `app` but do not enforce a fail-under threshold in `backend/pytest.ini`.

**View Coverage:**
```bash
pytest --cov=src/automationhub --cov-report=term-missing
pytest --cov=app --cov-report=html:htmlcov --cov-report=xml
```

## Test Types

**Unit Tests:**
- Primary pattern across `tests/` and many backend files: class-level suites, focused behavior tests, direct assertions on state transitions and validation errors.

**Integration Tests:**
- Marker-based integration and slow suites in backend (`@pytest.mark.integration`, `@pytest.mark.slow`) in files like `backend/tests/test_cloudflare_service.py`.
- Endpoint tests often mount FastAPI app with `TestClient` and mock service internals.

**E2E Tests:**
- No dedicated E2E framework detected in primary pytest configs. Root `test_*.py` scripts outside `tests/` exist but are excluded from default run.

## Common Patterns

**Async Testing:**
```typescript
@pytest.mark.asyncio
async def test_rate_limiter_check_and_raise():
    limiter = IntegrationRateLimiter("test", max_requests=1, window_seconds=10)
    await limiter.check_and_raise("k2")
    with pytest.raises(RuntimeError, match="Rate limit"):
        await limiter.check_and_raise("k2")
```

**Error Testing:**
```typescript
def test_create_schedule_invalid_interval_raises(self):
    scheduler = Scheduler()
    with pytest.raises(ValueError):
        scheduler.create_schedule("BadInterval", ScheduleType.INTERVAL, {"interval_seconds": 0})
```

---

*Testing analysis: 2026-04-21*
# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- `pytest` with async support and coverage plugins.
- Root config: `pyproject.toml` (`[tool.pytest.ini_options]`) targeting `tests/` with `--cov=src/automationhub --cov-report=term-missing --cov-fail-under=95`.
- Backend config: `backend/pytest.ini` with `--cov=app`, HTML/XML coverage output, strict markers, and warning filters.

**Assertion Library:**
- Built-in `pytest` assertions and `pytest.raises`.

**Run Commands:**
```bash
pytest
pytest -v
pytest --cov=src/automationhub --cov-report=term-missing --cov-fail-under=95
pytest --cov=app --cov-report=term-missing --cov-report=html:htmlcov --cov-report=xml
```

## Test File Organization

**Location:**
- `tests/` for `src/automationhub` and cross-module tests (examples: `tests/test_workflows.py`, `tests/test_workflow_executor.py`, `tests/test_document_processor.py`).
- `backend/tests/` for backend API/services/integration-style tests (examples: `backend/tests/test_auth_service.py`, `backend/tests/test_gateway.py`, `backend/tests/test_integrations.py`).

**Naming:**
- Use `test_*.py` files and `Test*` classes with `test_*` methods.
- Use `conftest.py` for shared fixtures (`tests/conftest.py`, `backend/tests/conftest.py`).

**Structure:**
```
tests/
  conftest.py
  test_*.py
backend/tests/
  conftest.py
  test_*.py
```

## Test Structure

**Suite Organization:**
```typescript
class TestWorkflow:
    def test_activate_requires_steps(self):
        wf = Workflow("Test", "Test")
        with pytest.raises(ValueError):
            wf.activate()

    @pytest.mark.asyncio
    async def test_execute_workflow(self):
        wf = Workflow("Test", "Test")
        wf.add_step({"name": "step1"})
        wf.activate()
        result = await wf.execute()
        assert result["status"] == "success"
```

**Patterns:**
- **Setup pattern:** fixtures build service instances and reusable payloads (`backend/tests/test_cloudflare_service.py`, `backend/tests/test_workflow_orchestration.py`).
- **Teardown pattern:** context managers and `finally` blocks restore dependency overrides and delete temporary files (`backend/tests/conftest.py`, `tests/test_document_processor.py`).
- **Assertion pattern:** assert status codes, selected response keys, and domain state transitions instead of full object snapshots.

## Mocking

**Framework:** `unittest.mock` (`Mock`, `MagicMock`, `AsyncMock`, `patch`, `patch.object`)

**Patterns:**
```typescript
with patch.object(auth_service, '_get_user_by_email') as mock_get_user:
    with patch('app.services.auth_service.verify_password') as mock_verify:
        mock_get_user.return_value = test_user
        mock_verify.return_value = True
        result = await auth_service.authenticate_user(mock_db, login_request)
        assert result.success is True
```

**What to Mock:**
- External boundaries and side effects: SMTP, Cloudflare HTTP client, auth integrations, database session behavior, MCP adapters (`backend/tests/test_auth_service.py`, `backend/tests/test_cloudflare_service.py`, `tests/test_workflow_executor.py`).
- FastAPI dependency overrides for auth/db where needed (`backend/tests/conftest.py`).

**What NOT to Mock:**
- Pure domain behavior in `src/automationhub` modules; instantiate real classes and assert state transitions (`tests/test_actions.py`, `tests/test_scheduler.py`, `tests/test_workflows.py`).

## Fixtures and Factories

**Test Data:**
```typescript
@pytest.fixture
def sample_provider_data(self):
    return {
        "name": "Test Cloudflare Account",
        "api_token": "test_api_token_123",
        "email": "test@example.com",
    }
```

**Location:**
- Shared bootstrap fixtures in `tests/conftest.py` and `backend/tests/conftest.py`.
- Domain-specific fixture factories colocated in each test module (for payloads, entities, mocked service responses).

## Coverage

**Requirements:** 
- Root tests enforce 95% minimum coverage for `src/automationhub` via `pyproject.toml`.
- Backend tests collect coverage for `app` but no fail-under threshold is set in `backend/pytest.ini`.

**View Coverage:**
```bash
pytest --cov=src/automationhub --cov-report=term-missing
pytest --cov=app --cov-report=html:htmlcov --cov-report=xml
```

## Test Types

**Unit Tests:**
- Dominant pattern for `src/automationhub` core logic and many backend helpers; heavy direct object testing and exception assertions.

**Integration Tests:**
- Marker-driven and scenario-oriented tests exist in backend (`@pytest.mark.integration`, `@pytest.mark.slow` in `backend/tests/test_cloudflare_service.py`).
- Some endpoint tests instantiate real FastAPI apps with `TestClient` while mocking service internals.

**E2E Tests:**
- No dedicated E2E framework detected (no Playwright/Cypress-style end-to-end harness in primary backend/root pytest config).

## Common Patterns

**Async Testing:**
```typescript
@pytest.mark.asyncio
async def test_rate_limiter_check_and_raise():
    limiter = IntegrationRateLimiter("test", max_requests=1, window_seconds=10)
    await limiter.check_and_raise("k2")
    with pytest.raises(RuntimeError, match="Rate limit"):
        await limiter.check_and_raise("k2")
```

**Error Testing:**
```typescript
def test_create_schedule_invalid_interval_raises(self):
    scheduler = Scheduler()
    with pytest.raises(ValueError):
        scheduler.create_schedule("BadInterval", ScheduleType.INTERVAL, {"interval_seconds": 0})
```

---

*Testing analysis: 2026-04-21*
# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- `pytest` ≥7.0
- Config: `pyproject.toml` (`[tool.pytest.ini_options]`)

**Plugins:**
- `pytest-asyncio` ≥0.21.0 — async test support (`asyncio_mode = "auto"`)
- `pytest-cov` ≥4.0 — coverage with enforced threshold

**Assertion Library:**
- `pytest` built-in `assert`; no separate assertion library

**Run Commands:**
```bash
pytest                             # Run all tests (with coverage, auto-configured)
pytest tests/test_workflows.py    # Run single file
pytest -k "test_create"           # Run by keyword
pytest --cov-report=html          # HTML coverage report
```

## Test File Organization

**Primary test directory:** `tests/` at project root

**Naming:**
- File: `test_[module].py` mirroring `src/automationhub/[module].py`
  - `tests/test_workflows.py` → `src/automationhub/workflows.py`
  - `tests/test_actions.py` → `src/automationhub/actions.py`
  - `tests/test_scheduler.py` → `src/automationhub/scheduler.py`
  - `tests/test_triggers.py` → `src/automationhub/triggers.py`
  - `tests/test_api.py` → `src/automationhub/api.py`

**Additional test files** at project root (integration/demo): `test_api_basic.py`, `test_full_api.py`, `test_rag_simple.py`, etc. — these are NOT run by default (pytest `testpaths = ["tests"]`).

**Conftest:**
- `tests/conftest.py` — minimal: inserts project root into `sys.path` for consistent imports. No shared fixtures defined here.

```
tests/
├── conftest.py              # sys.path bootstrap only
├── test_workflows.py
├── test_actions.py
├── test_scheduler.py
├── test_triggers.py
├── test_api.py
└── test_*.py                # additional domain tests
```

## Test Structure

**Suite Organization:** One `class Test[Subject]` per logical unit being tested

```python
class TestWorkflow:
    def test_create_workflow(self): ...
    def test_add_step(self): ...
    def test_activate_requires_steps(self): ...

class TestWorkflowEngine:
    def test_create_workflow(self): ...
    def test_list_workflows(self): ...
```

**No shared `setUp`/`tearDown`:** Each test instantiates its own fresh object. No pytest fixtures used for domain objects.

**Pattern:**
```python
def test_[behavior](self):
    # Arrange — create fresh instance(s)
    obj = DomainClass(...)
    # Act — call the method under test
    result = obj.method(...)
    # Assert — single or few assertions
    assert result == expected
```

## Async Tests

**Mode:** `asyncio_mode = "auto"` in `pyproject.toml` — all coroutines are auto-detected.

**Mark:** `@pytest.mark.asyncio` is used explicitly even with `auto` mode (belt-and-suspenders style):

```python
@pytest.mark.asyncio
async def test_execute_workflow(self):
    wf = Workflow("Test", "Test")
    wf.add_step({"name": "step1"})
    wf.activate()
    result = await wf.execute()
    assert result["status"] == "success"
    assert result["steps_executed"] == 1
```

## Error / Exception Testing

**Pattern:** Use `pytest.raises` as context manager, no message assertions:

```python
def test_add_step_without_name_raises(self):
    wf = Workflow("Test", "Test")
    with pytest.raises(ValueError):
        wf.add_step({"action": "http"})

def test_execute_disabled_action_raises(self):
    executor = ActionExecutor()
    action = Action("Test", ActionType.HTTP)
    executor.register_action(action)
    action.is_enabled = False
    with pytest.raises(ValueError):
        await executor.execute_action(action.id, {})
```

## Mocking

**Not used** in the `tests/` suite. No `unittest.mock`, `pytest-mock`, or `MagicMock` calls present.

All tests rely on real domain objects in memory. External dependencies (HTTP calls, email sending, database queries) are not exercised — the domain classes return stub results.

**What NOT to mock:** Domain objects (`Workflow`, `Action`, `Trigger`, `Schedule`) — always use real instances.

## Fixtures and Factories

**No pytest fixtures** for domain objects. Each test builds its own object graph inline.

**Inline factory pattern** (used in trigger callback tests):

```python
def test_subscribe_to_event(self):
    trigger = EventTrigger("MyEvent", "user.created")
    callback_called = False

    def callback(data):
        nonlocal callback_called
        callback_called = True

    trigger.subscribe(callback)
    trigger.emit({"user_id": "123"})
    assert callback_called is True
```

## Coverage

**Requirements:** 95% minimum enforced (`--cov-fail-under=95`)

**Target:** `src/automationhub` (`--cov=src/automationhub`)

**Default report:** `term-missing` (shows uncovered lines in terminal)

**View full HTML coverage:**
```bash
pytest --cov-report=html
open htmlcov/index.html
```

## Test Types

**Unit Tests (`tests/`):**
- Scope: Single class or method in isolation
- No network, no filesystem, no subprocess calls
- Fast, all in-memory

**Integration / Exploratory Tests (project root):**
- Files like `test_api_basic.py`, `test_full_api.py`, `test_rag_simple.py`
- NOT run by default (`testpaths = ["tests"]` excludes root)
- May require running services; treat as manual verification scripts

**E2E Tests:** `test_playwright_focused.py`, `test_multi_browser_support.py`, `test_frontend_workflows.py` at project root — Playwright-based browser automation, excluded from default test run

## Adding New Tests

1. Create `tests/test_[new_module].py`
2. Import from `src.automationhub.[new_module]` (absolute path — `conftest.py` sets up sys.path)
3. One `class Test[Subject]` per class being tested
4. Each test method: arrange fresh instance → act → assert
5. For async methods: add `@pytest.mark.asyncio` and `async def`
6. For `ValueError` paths: use `with pytest.raises(ValueError):`

---

*Testing analysis: 2026-04-21*

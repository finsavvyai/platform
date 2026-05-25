# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- Use `snake_case.py` for modules in `src/automationhub/` and `backend/app/` (examples: `src/automationhub/workflows.py`, `backend/app/services/workflow_executor.py`).
- Use `test_*.py` for tests in `tests/` and `backend/tests/` (examples: `tests/test_workflows.py`, `backend/tests/test_auth_service.py`).

**Functions:**
- Use `snake_case` for sync and async functions (`create_workflow`, `health_check`, `execute_workflow`) in `src/automationhub/api.py`, `backend/app/main.py`, and `backend/app/api/v1/endpoints/workflows.py`.
- Keep endpoint handler names action-focused (`pause_execution`, `resume_execution`, `cancel_execution`) in `backend/app/api/v1/endpoints/workflows.py`.

**Variables:**
- Use `snake_case` for fields, locals, and fixtures (`execution_history`, `sample_provider_data`, `mock_db_session`) in `src/automationhub/workflows.py`, `backend/tests/test_cloudflare_service.py`, and `backend/tests/conftest.py`.
- Use `UPPER_SNAKE_CASE` for constants and enum values (`ROOT_DIR`, `WorkflowStatus.ACTIVE`, `NodeType.MCP_TOOL`) in `tests/conftest.py`, `src/automationhub/workflows.py`, and `backend/app/services/workflow_executor.py`.

**Types:**
- Use explicit typing (`Dict[str, Any]`, `List[...]`, `Optional[...]`) in `src/automationhub/*.py` and `backend/app/services/workflow_executor.py`.
- Use Pydantic models for API request/response contracts in `backend/app/api/v1/endpoints/workflows.py`.

## Code Style

**Formatting:**
- No formatter config detected for this app (`pyproject.toml` has no `[tool.black]`/`[tool.ruff.format]`).
- Follow existing style: 4-space indentation, wrapped signatures, and explicit type hints from `src/automationhub/scheduler.py` and `backend/app/api/v1/endpoints/workflows.py`.

**Linting:**
- No dedicated lint config detected (`.flake8`, root ruff, and `mypy.ini` are not present for this app).
- Preserve current static quality signals: typed signatures, explicit error branches, and consistent import grouping.

## Import Organization

**Order:**
1. Standard library imports first (`datetime`, `uuid`, `typing`) in `src/automationhub/workflows.py`.
2. Third-party imports next (`fastapi`, `pydantic`, `sqlalchemy`) in `backend/app/main.py` and `backend/app/services/workflow_executor.py`.
3. Local package imports last (`from app...`, `from .workflows ...`) in `backend/app/api/v1/endpoints/workflows.py` and `src/automationhub/api.py`.

**Path Aliases:**
- Backend code/tests import from `app...` (`backend/tests/test_auth_service.py`).
- Root tests for `src` import from `src.automationhub...` (`tests/test_api.py`).

## Error Handling

**Patterns:**
- Raise `ValueError` for domain validation and invalid state in `src/automationhub/actions.py`, `src/automationhub/workflows.py`, and `src/automationhub/scheduler.py`.
- In API endpoints, catch and log exceptions, then translate to `HTTPException` with explicit status codes in `backend/app/api/v1/endpoints/workflows.py`.
- Preserve existing HTTP errors by explicitly re-raising `HTTPException` in endpoint handlers.

## Logging

**Framework:** `logging`

**Patterns:**
- Define module logger with `logging.getLogger(__name__)` in backend modules (`backend/app/main.py`, `backend/app/services/workflow_executor.py`, `backend/app/api/v1/endpoints/workflows.py`).
- Log startup/shutdown and normal operation at `info`; recoverable conditions at `warning`; failures at `error`.

## Comments

**When to Comment:**
- Use module/class/function docstrings heavily in backend services and tests (`backend/app/services/workflow_executor.py`, `backend/tests/test_gateway.py`).
- Use inline comments for non-obvious setup and fallback behavior (`backend/app/main.py`, `backend/tests/conftest.py`).

**JSDoc/TSDoc:**
- Not applicable. Use Python docstrings.

## Function Design

**Size:** 
- Keep `src/automationhub` methods compact and single-purpose (`src/automationhub/actions.py`, `src/automationhub/api.py`).
- For large backend modules (notably `backend/app/services/workflow_executor.py`), add new behavior via helper methods instead of extending already long methods.

**Parameters:** 
- Use typed parameters and optional config defaults (`config: Optional[Dict[str, Any]] = None`) as in `src/automationhub/scheduler.py` and `src/automationhub/triggers.py`.
- In API layer, accept Pydantic request models plus dependency-injected user/session context in `backend/app/api/v1/endpoints/workflows.py`.

**Return Values:** 
- Domain modules in `src/automationhub` commonly return dictionaries for payloads and status.
- Endpoint layer returns typed Pydantic response models (`WorkflowResponse`, `ExecutionResponse`) in `backend/app/api/v1/endpoints/workflows.py`.

## Module Design

**Exports:** 
- Import directly from concrete modules (`app.services.workflow_executor`, `src.automationhub.workflows`) instead of central barrel files.

**Barrel Files:** 
- Not a primary Python pattern in this repository.

---

*Convention analysis: 2026-04-21*
# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- Use `snake_case.py` for modules across `src/automationhub/` and `backend/app/` (examples: `src/automationhub/workflows.py`, `backend/app/services/workflow_executor.py`, `backend/app/api/v1/endpoints/workflows.py`).
- Use `test_*.py` for tests in both `tests/` and `backend/tests/` (examples: `tests/test_workflows.py`, `backend/tests/test_auth_service.py`).

**Functions:**
- Use `snake_case` for functions and methods, including async handlers (examples: `execute_workflow()` in `src/automationhub/api.py`, `health_check()` in `backend/app/main.py`, `list_workflows()` in `backend/app/api/v1/endpoints/workflows.py`).
- Keep endpoint handler names action-oriented (`create_workflow`, `pause_execution`, `cancel_execution`) in `backend/app/api/v1/endpoints/workflows.py`.

**Variables:**
- Use `snake_case` for local variables and attributes (`execution_history`, `mock_db_session`, `sample_provider_data`) in `src/automationhub/workflows.py`, `backend/tests/conftest.py`, and `backend/tests/test_cloudflare_service.py`.
- Use `UPPER_SNAKE_CASE` for constants and enum members (`ROOT_DIR`, `WorkflowStatus.ACTIVE`, `NodeType.MCP_TOOL`) in `tests/conftest.py`, `src/automationhub/workflows.py`, and `backend/app/services/workflow_executor.py`.

**Types:**
- Use explicit typing with `Dict[str, Any]`, `List[...]`, `Optional[...]`, and enum classes in `src/automationhub/*.py` and `backend/app/services/workflow_executor.py`.
- Use Pydantic models for API contracts in `backend/app/api/v1/endpoints/workflows.py` (`WorkflowCreateRequest`, `ExecutionResponse`).

## Code Style

**Formatting:**
- No formatter configuration detected in the root app (`pyproject.toml` has no `[tool.black]`/`[tool.ruff.format]` section).
- Follow current style: 4-space indentation, moderate line wrapping, and type hints on public methods as shown in `src/automationhub/scheduler.py` and `backend/app/api/v1/endpoints/workflows.py`.

**Linting:**
- No dedicated lint config detected for this app (`.flake8`, `mypy.ini`, and root ruff config not present).
- Keep code consistent with existing static patterns: typed signatures, explicit exception paths, and readable branch structure from `src/automationhub/triggers.py` and `backend/app/services/workflow_executor.py`.

## Import Organization

**Order:**
1. Standard library imports first (`datetime`, `uuid`, `typing`) in `src/automationhub/workflows.py`.
2. Third-party imports next (`fastapi`, `pydantic`, `sqlalchemy`) in `backend/app/main.py` and `backend/app/services/workflow_executor.py`.
3. Local app imports last (`from app...`, `from .workflows ...`) in `backend/app/api/v1/endpoints/workflows.py` and `src/automationhub/api.py`.

**Path Aliases:**
- Use package imports rooted at `app` in backend code/tests (`from app.services...`) as in `backend/tests/test_auth_service.py`.
- Use `src.automationhub` imports in top-level app tests (`tests/test_api.py`).

## Error Handling

**Patterns:**
- Use `ValueError` for domain validation failures in core modules (`src/automationhub/actions.py`, `src/automationhub/workflows.py`, `src/automationhub/scheduler.py`).
- In API endpoints, catch broad exceptions, log, and convert to `HTTPException` with explicit status codes (`backend/app/api/v1/endpoints/workflows.py`).
- Preserve framework exceptions by re-raising `HTTPException` explicitly (`except HTTPException: raise`) in endpoint modules.

## Logging

**Framework:** `logging`

**Patterns:**
- Module-level logger via `logger = logging.getLogger(__name__)` in backend modules (`backend/app/main.py`, `backend/app/api/v1/endpoints/workflows.py`, `backend/app/services/workflow_executor.py`).
- Log operational milestones with `info`, recoverable failures with `warning`, and execution failures with `error`.
- Prefer structured string context in log messages (IDs, node names, route paths) as seen in `backend/app/services/workflow_executor.py`.

## Comments

**When to Comment:**
- Use module docstrings and class/method docstrings extensively in backend service and test modules (`backend/app/services/workflow_executor.py`, `backend/tests/test_gateway.py`).
- Add targeted inline comments before non-obvious branches (resource checks, startup fallbacks, test setup assumptions) in `backend/app/main.py` and `backend/tests/conftest.py`.

**JSDoc/TSDoc:**
- Not applicable for Python modules; use Python docstrings for API and service contracts.

## Function Design

**Size:** 
- Keep `src/automationhub` functions compact and single-purpose (example files: `src/automationhub/actions.py`, `src/automationhub/api.py`).
- Backend contains very large service modules (notably `backend/app/services/workflow_executor.py`); add new behavior via focused helper methods instead of extending already large methods.

**Parameters:**
- Prefer typed parameters with defaults for optional config objects (`config: Optional[Dict[str, Any]] = None`) in `src/automationhub/scheduler.py` and `src/automationhub/triggers.py`.
- For endpoints, accept Pydantic request models and dependency-injected user/session context in `backend/app/api/v1/endpoints/workflows.py`.

**Return Values:**
- Return dictionaries for API-like payloads in core `src/automationhub` modules (`to_dict()`, `execute()`).
- Return typed Pydantic response models in backend endpoint layer (`WorkflowResponse`, `ExecutionResponse` in `backend/app/api/v1/endpoints/workflows.py`).

## Module Design

**Exports:**
- Use direct module exports without barrel files in Python packages; import symbols from concrete modules (`app.services.workflow_executor`, `src.automationhub.workflows`).
- Package `__init__.py` files exist but module-level imports are preferred (`src/automationhub/__init__.py`, `backend/tests/__init__.py`).

**Barrel Files:**
- Not a primary pattern in Python code; use explicit imports from target module paths.

---

*Convention analysis: 2026-04-21*
# Coding Conventions

**Analysis Date:** 2026-04-21

## Naming Patterns

**Files:**
- `snake_case.py` for all Python source files (e.g., `workflows.py`, `actions.py`, `scheduler.py`)
- No barrel files; each module exports its own classes directly

**Classes:**
- `PascalCase` for all class names (e.g., `Workflow`, `WorkflowEngine`, `ActionExecutor`, `TriggerManager`)
- Subclasses are named as `[Concept][Discriminator]` (e.g., `HTTPAction`, `EmailAction`, `IntervalSchedule`, `CronSchedule`)
- Enums: `PascalCase` class name, `SCREAMING_SNAKE_CASE` members (e.g., `WorkflowStatus.DRAFT`, `ActionType.HTTP`)

**Methods and Functions:**
- `snake_case` for all method and function names (e.g., `add_step`, `mark_executed`, `register_callback`)
- Boolean-returning methods use verb prefixes: `validate_*`, `validate_cron`, `validate_webhook`
- Factory/manager methods: `create_*`, `get_*`, `list_*`, `delete_*`, `register_*`, `activate_*`, `deactivate_*`

**Variables and Parameters:**
- `snake_case` for all variables (e.g., `workflow_id`, `trigger_type`, `cron_expression`)
- Boolean fields use `is_` prefix (e.g., `is_active`, `is_enabled`, `can_be_manually_triggered`)
- Optional fields typed as `Optional[T]` and defaulted to `None` (e.g., `last_fired: Optional[datetime] = None`)

**Test Classes and Methods:**
- Test class: `Test[Subject]` (e.g., `TestWorkflow`, `TestWorkflowEngine`, `TestActionExecutor`)
- Test method: `test_[behavior]` in plain English snake_case (e.g., `test_activate_requires_steps`, `test_create_schedule_invalid_interval_raises`)

## Code Style

**Formatting:**
- No formatter configuration detected (no `.prettierrc`, no `pyproject.toml [tool.black]`, no `ruff` format section)
- Observed indentation: 4 spaces consistently
- Max line length appears to be ~100 characters based on method signatures

**Linting:**
- No linting configuration detected (no `.flake8`, no `[tool.ruff]`, no `[tool.mypy]`)
- Type annotations used throughout source code (but not enforced by tooling config)

## Type Annotations

**Pattern:** Full type annotations on all method signatures in source modules

```python
def create_schedule(
    self, name: str, schedule_type: ScheduleType, config: Optional[Dict[str, Any]] = None
) -> Schedule:
```

**Imports:**
- Always import from `typing`: `Any`, `Dict`, `List`, `Optional`, `Callable`
- No use of the newer `dict[str, Any]` or `list[str]` lowercase generics (Python 3.9+ style) — stick with `typing` module imports to match existing code

## Import Organization

**Order observed in source files:**
1. Standard library (e.g., `uuid`, `datetime`, `enum`, `typing`, `hmac`, `hashlib`)
2. Relative imports from within the package (e.g., `from .workflows import WorkflowEngine`)

**Test file imports:**
1. `pytest`
2. Absolute imports from `src.automationhub.*`

**No third-party imports** in `src/automationhub/` source code (framework-agnostic core).

**Path style in tests:**
- Use absolute path `src.automationhub.module` (not relative), since `conftest.py` inserts the project root into `sys.path`

## Error Handling

**Pattern:** Raise `ValueError` with descriptive messages for all invalid input/state transitions

```python
if not name:
    raise ValueError("Workflow name is required")

if not self.steps:
    raise ValueError("Workflow must have at least one step")

if not action.is_enabled:
    raise ValueError(f"Action {action_id} is disabled")
```

**API-layer pattern:** Catch `ValueError` from domain methods, return `False` or `None` instead of propagating

```python
def activate_workflow(self, workflow_id: str) -> bool:
    workflow = self.workflow_engine.get_workflow(workflow_id)
    if workflow:
        try:
            workflow.activate()
            return True
        except ValueError:
            return False
    return False
```

**Not-found returns:** Domain managers return `None` for missing items; API layer returns `False` or `[]`

## Module Design

**Pattern:** Each domain concept owns one file:
- `src/automationhub/workflows.py` — `Workflow`, `WorkflowEngine`
- `src/automationhub/actions.py` — `Action`, action subclasses, `ActionExecutor`
- `src/automationhub/scheduler.py` — `Schedule`, schedule subclasses, `Scheduler`
- `src/automationhub/triggers.py` — `Trigger`, trigger subclasses, `TriggerManager`
- `src/automationhub/api.py` — `AutomationAPI` (facade over all managers)

**Class design:** Each domain area follows a triple structure:
1. Base class (e.g., `Action`)
2. Typed subclasses (e.g., `HTTPAction`, `EmailAction`)
3. Manager/executor (e.g., `ActionExecutor`)

**Serialization:** Domain objects expose `to_dict()` returning `Dict[str, Any]`. Callers (API layer) never expose raw objects to consumers.

**IDs:** All domain objects self-assign a UUID on construction: `self.id = str(uuid.uuid4())`

**Timestamps:** All domain objects use `datetime.now()` for `created_at`/`updated_at`; stored as naive datetimes (no timezone).

## Enums

All enums inherit from both `str` and `Enum`:

```python
class WorkflowStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
```

This allows direct string comparison and JSON serialization via `.value`.

## Comments

**Observed pattern:** No inline comments in source code. Logic is expressed through descriptive names alone.

**Docstrings:** Not present in `src/automationhub/` source modules. No JSDoc/docstring convention enforced.

---

*Convention analysis: 2026-04-21*

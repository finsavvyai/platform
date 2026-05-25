# Integration Guide: Robust Code & Apple HIG

## Quick Integration Steps

### 1. Add Error Handler Middleware

Update `src/udp/api/main.py`:

```python
from udp.api.middleware.error_handler import ErrorHandlerMiddleware

# Add error handler middleware (should be early in the stack)
app.add_middleware(ErrorHandlerMiddleware)
```

**Placement**: Add after other middleware but before route handlers.

### 2. Use Apple HIG Template

Update your report generation code:

```python
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates/reports")

@app.get("/api/v1/reports/{report_id}")
async def get_report(report_id: UUID, request: Request):
    # Generate report data
    report_data = await generate_report(report_id)
    
    # Use Apple HIG template
    return templates.TemplateResponse(
        "default-apple-hig.html",
        {
            "request": request,
            "report_metadata": report_data.metadata,
            "executive_summary": report_data.executive_summary,
            # ... other data
        }
    )
```

### 3. Use Validators in API Endpoints

Example endpoint with validation:

```python
from udp.core.validation import EmailValidator, UUIDValidator, StringValidator
from fastapi import HTTPException

@app.post("/api/v1/users")
async def create_user(user_data: dict):
    # Validate email
    email_result = EmailValidator.validate(user_data.get("email", ""))
    if not email_result:
        raise HTTPException(
            status_code=400,
            detail={"errors": email_result.errors}
        )
    
    # Sanitize email
    email = EmailValidator.sanitize(user_data["email"])
    
    # Validate other fields
    name_result = StringValidator.validate_length(
        user_data.get("name", ""),
        min_length=2,
        max_length=100,
        field_name="Name"
    )
    if not name_result:
        raise HTTPException(
            status_code=400,
            detail={"errors": name_result.errors}
        )
    
    # Create user with validated data
    # ...
```

### 4. Enhanced Error Responses

The error handler automatically provides structured responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "request_id": "123e4567-e89b-12d3-a456-426614174000",
    "details": {
      "errors": [...]
    }
  }
}
```

### 5. Update Existing Templates

Replace existing template references:

**Before:**
```python
return templates.TemplateResponse("default.html", {...})
```

**After:**
```python
return templates.TemplateResponse("default-apple-hig.html", {...})
```

---

## Testing

### Test Error Handling

```python
import pytest
from httpx import AsyncClient

async def test_error_handling(client: AsyncClient):
    # Test validation error
    response = await client.post("/api/v1/users", json={"invalid": "data"})
    assert response.status_code == 422
    assert "error" in response.json()
    assert "request_id" in response.json()["error"]
    
    # Test database error
    response = await client.post("/api/v1/users", json={"email": "duplicate@example.com"})
    assert response.status_code == 409  # Conflict
```

### Test Validators

```python
from udp.core.validation import EmailValidator, UUIDValidator

def test_email_validator():
    result = EmailValidator.validate("test@example.com")
    assert result.is_valid is True
    
    result = EmailValidator.validate("invalid-email")
    assert result.is_valid is False
    assert len(result.errors) > 0
```

---

## Benefits

### Code Robustness
- ✅ Comprehensive error handling
- ✅ Type-safe validation
- ✅ Structured error responses
- ✅ Request tracking
- ✅ Proper logging

### Apple HIG Compliance
- ✅ Native Apple design language
- ✅ Dark mode support
- ✅ Accessibility compliant
- ✅ Responsive design
- ✅ Professional appearance

---

**Ready to integrate! 🚀**

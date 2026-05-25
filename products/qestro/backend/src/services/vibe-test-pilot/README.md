# Vibe Test Pilot Engine

AI-powered test generation system for Qestro. Generates production-grade Playwright and API tests from URLs or natural language descriptions.

## Architecture

The Vibe Test Pilot follows a modular, single-responsibility design pattern:

```
User Input
    |
    v
VibeTestPilot (Orchestrator)
    |
    +-- PageAnalyzer (Extract page elements)
    |
    +-- AITestProvider (Generate scenarios via OpenAI)
    |   +-- AIPromptBuilder (Construct prompts)
    |   +-- AIResponseParser (Parse AI responses)
    |
    +-- TestCodeGenerator (Convert scenarios to code)
    |   +-- CodeTemplates (Step & assertion templates)
    |
    +-- TestPersistence (Save to database)
    |
    v
Generated Test Cases (stored in testCases table)
```

## Files

| File | Lines | Purpose |
|------|-------|---------|
| **types.ts** | 148 | TypeScript interfaces for all test generation types |
| **PageAnalyzer.ts** | 179 | Crawls pages, extracts forms, buttons, links, modals, flows |
| **SelectorBuilder.ts** | 35 | Generates stable element selectors (ID, name, data-testid, CSS) |
| **AITestProvider.ts** | 142 | OpenAI integration for scenario & assertion generation |
| **AIPromptBuilder.ts** | 101 | Constructs prompts for OpenAI |
| **AIResponseParser.ts** | 69 | Parses JSON responses from OpenAI |
| **TestCodeGenerator.ts** | 161 | Converts scenarios to Playwright/API code |
| **CodeTemplates.ts** | 107 | Step & assertion code generation templates |
| **VibeTestPilot.ts** | 172 | Main orchestrator - coordinates all components |
| **TestPersistence.ts** | 41 | Database operations for saving tests |

## API Routes

### Generation Routes (`vibe-pilot-generation.routes.ts`)

#### POST `/api/vibe-pilot/generate-from-url`
Generate tests from a URL.

**Request:**
```json
{
  "url": "https://example.com/login",
  "projectId": "uuid",
  "userId": "uuid",
  "framework": "playwright"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tests": [
      {
        "id": "test-xxx-yyy",
        "name": "Login Flow Test",
        "description": "Tests user login functionality",
        "code": "import { test, expect } from '@playwright/test';\n...",
        "scenarios": [...],
        "validation": { "isValid": true, "errors": [], "warnings": [] },
        "timestamp": "2026-04-07T15:30:00Z"
      }
    ],
    "count": 1,
    "timestamp": "2026-04-07T15:30:00Z"
  }
}
```

#### POST `/api/vibe-pilot/generate-from-description`
Generate tests from natural language.

**Request:**
```json
{
  "description": "Test user login with email and password validation",
  "projectId": "uuid",
  "userId": "uuid",
  "framework": "playwright"
}
```

**Response:** Same as above

### Utility Routes (`vibe-pilot-utility.routes.ts`)

#### POST `/api/vibe-pilot/analyze-page`
Analyze a page to extract testable elements.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "url": "https://example.com",
      "title": "Example",
      "formCount": 2,
      "buttonsCount": 5,
      "linksCount": 12,
      "modalsCount": 1,
      "elements": [...],
      "flows": [...],
      "metadata": { "loadTime": 1234, "isResponsive": true, "hasAccessibility": true }
    }
  }
}
```

#### POST `/api/vibe-pilot/validate`
Validate generated test code.

**Request:**
```json
{
  "code": "import { test, expect } from '@playwright/test';\n..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": ["No imports found"],
      "syntax": { "hasParseErrors": false, "parseErrors": [] }
    }
  }
}
```

#### GET `/api/vibe-pilot/templates`
Get available test templates.

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "login-flow",
        "name": "Login Flow",
        "description": "Test user authentication",
        "framework": "playwright",
        "category": "auth"
      },
      ...
    ],
    "count": 6
  }
}
```

### Refinement Routes (`vibe-pilot.routes.ts`)

#### POST `/api/vibe-pilot/refine/:testId`
Refine an existing test based on user feedback.

**Request:**
```json
{
  "feedback": "Add more assertions for error handling"
}
```

**Response:** Generated test object (same format as generation endpoints)

#### POST `/api/vibe-pilot/health`
Health check for the Vibe Test Pilot service.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "vibe-test-pilot",
    "features": [
      "URL-based test generation",
      "Description-based test generation",
      "Page analysis",
      "Code validation",
      "Test templates"
    ]
  }
}
```

## Usage Examples

### Generate Tests from URL

```bash
curl -X POST http://localhost:3000/api/vibe-pilot/generate-from-url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/login",
    "projectId": "proj-123",
    "userId": "user-456",
    "framework": "playwright"
  }'
```

### Generate Tests from Description

```bash
curl -X POST http://localhost:3000/api/vibe-pilot/generate-from-description \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create a test that validates user signup with email verification",
    "projectId": "proj-123",
    "userId": "user-456",
    "framework": "playwright"
  }'
```

### Analyze Page

```bash
curl -X POST http://localhost:3000/api/vibe-pilot/analyze-page \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com"
  }'
```

## Type System

### Core Types (types.ts)

**GenerateOptions**
```typescript
interface GenerateOptions {
  projectId: string;
  userId: string;
  framework?: 'playwright' | 'cypress' | 'maestro' | 'api';
  includeAssertions?: boolean;
  includeScreenshots?: boolean;
  targetBrowsers?: ('chromium' | 'firefox' | 'webkit')[];
  headless?: boolean;
}
```

**GeneratedTest**
```typescript
interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  scenarios: TestScenario[];
  code: string;
  language: 'typescript' | 'javascript' | 'yaml';
  framework: string;
  validation: ValidationResult;
  timestamp: Date;
}
```

**TestScenario**
```typescript
interface TestScenario {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  assertions: Assertion[];
  expectedResults: string[];
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}
```

**TestStep**
```typescript
interface TestStep {
  action: 'goto' | 'click' | 'fill' | 'select' | 'wait' | 'screenshot' | 'hover' | 'press';
  target?: string;
  value?: string;
  timeout?: number;
  description?: string;
}
```

**Assertion**
```typescript
interface Assertion {
  type: 'text' | 'visible' | 'hidden' | 'enabled' | 'disabled' | 'url' | 'title' | 'attribute' | 'count';
  target: string;
  expected?: string | number | boolean;
  description?: string;
}
```

## Configuration

### Environment Variables

```bash
# OpenAI API Configuration
OPENAI_API_KEY=sk-...

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/qestro

# Optional
NODE_ENV=production
```

## Error Handling

All services implement comprehensive error handling:

1. **PageAnalyzer**: Validates URLs, handles browser timeouts, gracefully closes resources
2. **AITestProvider**: Retries failed API calls (up to 3 attempts) with exponential backoff
3. **TestCodeGenerator**: Validates syntax, reports parse errors and warnings
4. **VibeTestPilot**: Logs all errors and provides meaningful error messages to clients

## Testing

Each module should have unit tests:

```typescript
// Test PageAnalyzer
test('PageAnalyzer.analyzePage extracts buttons', async () => {
  const analysis = await pageAnalyzer.analyzePage('http://localhost:3000');
  expect(analysis.buttonsCount).toBeGreaterThan(0);
});

// Test TestCodeGenerator
test('TestCodeGenerator validates Playwright syntax', () => {
  const code = "import { test } from '@playwright/test';";
  const validation = testCodeGenerator.validateGeneratedCode(code);
  expect(validation.isValid).toBe(true);
});
```

## Performance Considerations

- **PageAnalyzer**: Limits element extraction to MAX_ELEMENTS (100) for performance
- **AITestProvider**: Caches API calls, implements retry logic with backoff
- **Database**: Saves tests asynchronously without blocking response
- **Memory**: Closes browser contexts after page analysis to free resources

## Future Enhancements

1. **Visual Regression Testing**: Screenshot comparison for visual assertions
2. **Mobile Testing**: Maestro integration for iOS/Android automation
3. **API Chaining**: Support for multi-step API workflows
4. **Self-Healing**: AI-driven test repair on assertion failures
5. **Performance Monitoring**: Test execution time tracking and optimization
6. **Custom Models**: Support for private/fine-tuned OpenAI models
7. **Batch Generation**: Generate multiple tests from test plan documents
8. **Test Merging**: Combine related test scenarios into test suites

## Troubleshooting

### OpenAI API Errors
- Verify API key is set in environment
- Check OpenAI account billing and limits
- Ensure request is within token limits (max 2000 tokens)

### Page Analysis Failures
- Validate URL is reachable and loads within 30s timeout
- Check page doesn't require authentication
- Ensure page has interactive elements (buttons, forms, etc.)

### Code Generation Issues
- Review AI-generated code for accuracy
- Validate selectors exist on actual page
- Check assertions match expected behavior
- Use `/validate` endpoint to debug generated code

## Contributing

When adding new features:

1. Keep files under 200 lines (split by concern)
2. Use strict TypeScript (no `any` types)
3. Add JSDoc comments for public methods
4. Implement proper error handling
5. Log important operations
6. Write unit tests (80%+ coverage)

## References

- [Playwright Documentation](https://playwright.dev)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Qestro Architecture](../../../README.md)

---
name: ll-api-client
displayName: Luna API Client Generator
description: Generate typed API client SDK from routes or OpenAPI spec
version: 1.0.0
category: development
agent: luna-api-generator
parameters:
  - name: source
    type: string
    description: Path to API routes directory or OpenAPI spec file
    required: true
    prompt: true
  - name: scope
    type: string
    description: Project or feature scope
    required: true
    prompt: true
workflow:
  - discover_api_endpoints
  - extract_types_and_schemas
  - generate_client_functions
  - generate_type_definitions
  - generate_error_handling
  - write_client_tests
  - generate_client_report
output:
  - .luna/{current-project}/api-client/
  - .luna/{current-project}/api-client-report.md
prerequisites: []
---

# Luna API Client Generator

Generate a fully typed API client from your backend routes.

## What This Command Does

1. **Discover** — scans API routes or reads OpenAPI/Swagger spec
2. **Extract** — pulls request/response types, query params, headers
3. **Generate Client** — creates typed fetch/axios functions per endpoint
4. **Generate Types** — exports all request/response TypeScript types
5. **Error Handling** — adds typed error responses and retry logic
6. **Tests** — writes tests for each client function
7. **Report** — documents all endpoints with usage examples

## Output Structure

```
api-client/
  client.ts           # Main client with base URL, auth, interceptors
  endpoints/
    auth.ts           # signIn(), signOut(), getSession()
    workflows.ts      # listWorkflows(), createWorkflow(), etc.
    teams.ts          # listTeams(), inviteMember(), etc.
  types/
    requests.ts       # All request body types
    responses.ts      # All response types
    errors.ts         # Error response types
  client.test.ts      # Client tests with MSW mocks
```

## Usage

```
/api-client src/routes/           # From route files
/api-client openapi.json          # From OpenAPI spec
/api-client https://api.example.com/.well-known/openapi.json
```

## Features

- Typed request bodies, query params, and responses
- Auth header injection (Bearer, API key)
- Automatic retry with exponential backoff
- Request/response interceptors
- MSW mock handlers for testing

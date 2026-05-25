# Test Impact Analysis Service

Intelligent analysis of code changes and their impact on test suites. Determines which tests are affected by code changes, calculates risk levels, and optimizes test execution.

## Features

- **Change Impact Analysis**: Identify tests affected by code changes
- **Dependency Graphing**: Build test-to-code dependency relationships
- **Risk Assessment**: Calculate risk levels for code changes
- **Coverage Mapping**: Track which files are covered by which tests
- **Smart Test Selection**: Run only affected tests to save CI/CD time
- **Failure Probability**: Estimate likelihood of test failure

## Architecture

### Components

1. **ImpactAnalyzer**: Main orchestrator for impact analysis
2. **CoverageMapper**: Maps code coverage to test dependencies
3. **Routes**: REST API for analysis and coverage management

### How It Works

```
Code Changes → Coverage Map → Affected Tests
                ↓
        Risk Assessment → Recommendations
```

## API Reference

### Impact Analysis

#### Analyze Code Changes
```http
POST /api/impact/analyze
Content-Type: application/json

{
  "projectId": "project-123",
  "changes": [
    {
      "filePath": "src/auth.ts",
      "changeType": "modified",
      "additions": 50,
      "deletions": 20,
      "linesChanged": ["line 1", "line 2"],
      "commitHash": "abc123"
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "result": {
    "projectId": "project-123",
    "changes": [...],
    "affectedTests": [
      {
        "testId": "test-1",
        "testName": "Auth Tests",
        "impactLevel": "direct",
        "failureProbability": 0.7,
        "estimatedRunTime": 5000
      }
    ],
    "risk": {
      "riskLevel": "high",
      "riskScore": 0.65,
      "affectedTestsCount": 12,
      "criticalFiles": ["src/auth.ts"],
      "recommendations": [
        "Run full test suite before deployment",
        "Consider running in parallel"
      ]
    },
    "stats": {
      "totalChanges": 1,
      "totalAffectedTests": 12,
      "directImpact": 8,
      "indirectImpact": 4,
      "estimatedTestRunTime": 45000
    }
  }
}
```

#### Get Affected Tests for File
```http
GET /api/impact/tests/src/auth.ts?projectId=project-123
```

#### Get Dependency Graph
```http
GET /api/impact/graph/project-123
```

Response:
```json
{
  "success": true,
  "projectId": "project-123",
  "graph": {
    "nodes": {
      "test-1": {
        "type": "test",
        "dependencies": ["src/auth.ts", "src/middleware.ts"],
        "dependents": []
      },
      "src/auth.ts": {
        "type": "source",
        "dependencies": [],
        "dependents": ["test-1", "test-2"]
      }
    },
    "edges": [
      {
        "source": "test-1",
        "target": "src/auth.ts",
        "type": "covers"
      }
    ]
  },
  "stats": {
    "nodes": 25,
    "edges": 45
  }
}
```

### Coverage Management

#### Update Test Coverage
```http
POST /api/impact/coverage
Content-Type: application/json

{
  "testId": "test-1",
  "coveredFiles": ["src/auth.ts", "src/middleware.ts"],
  "projectId": "project-123"
}
```

#### Batch Update Coverage
```http
POST /api/impact/batch-coverage
Content-Type: application/json

{
  "projectId": "project-123",
  "coverageData": [
    {
      "testId": "test-1",
      "coveredFiles": ["src/auth.ts"]
    },
    {
      "testId": "test-2",
      "coveredFiles": ["src/user.ts"]
    }
  ]
}
```

#### Get Coverage Statistics
```http
GET /api/impact/coverage/project-123
```

Response:
```json
{
  "success": true,
  "projectId": "project-123",
  "stats": {
    "totalFiles": 150,
    "coveredFiles": 120,
    "coverage": 80.0,
    "byFile": {
      "src/auth.ts": {
        "coverage": 95,
        "testCount": 5,
        "tests": ["test-1", "test-2", "test-3", "test-4", "test-5"]
      }
    },
    "gaps": ["src/legacy.ts", "src/temp.ts"]
  }
}
```

#### Get Tests Covering File
```http
GET /api/impact/coverage-files/src/auth.ts
```

### Test Registration

#### Register Test Metadata
```http
POST /api/impact/register-test
Content-Type: application/json

{
  "testId": "test-1",
  "testName": "Auth Tests",
  "testPath": "src/tests/auth.test.ts",
  "estimatedRunTime": 5000
}
```

## Usage Example

```typescript
import { impactAnalyzer, coverageMapper } from './index.js';

// Register test metadata
impactAnalyzer.registerTest('test-1', 'Auth Tests', 'src/tests/auth.test.ts', 5000);
impactAnalyzer.registerTest('test-2', 'User Tests', 'src/tests/user.test.ts', 3000);

// Update coverage data (e.g., from test execution with coverage)
await coverageMapper.updateCoverage(
  'test-1',
  ['src/auth.ts', 'src/middleware.ts'],
  'project-123'
);

await coverageMapper.updateCoverage(
  'test-2',
  ['src/user.ts', 'src/db.ts'],
  'project-123'
);

// Analyze impact of code changes
const result = await impactAnalyzer.analyzeImpact('project-123', [
  {
    filePath: 'src/auth.ts',
    changeType: 'modified',
    additions: 50,
    deletions: 20,
    linesChanged: ['line 1', 'line 2'],
    timestamp: new Date(),
    commitHash: 'abc123',
  },
]);

console.log(`Affected tests: ${result.affectedTests.length}`);
console.log(`Risk level: ${result.risk.riskLevel}`);
console.log(`Recommendations:`, result.risk.recommendations);

// Get tests for a file
const testsForAuth = await impactAnalyzer.getAffectedTests('src/auth.ts');
console.log(`Tests covering auth.ts: ${testsForAuth.length}`);

// Build dependency graph
const graph = await impactAnalyzer.buildDependencyGraph('project-123');
console.log(`Dependencies: ${graph.edges.length}`);
```

## Risk Levels

### Low
- Few files changed (< 5)
- Affected tests < 5
- No critical files modified

### Medium
- Multiple files changed (5-20)
- Affected tests 5-20
- Non-critical changes

### High
- Many files changed (> 20)
- Affected tests > 20
- Large additions/deletions
- Utility/shared code modified

### Critical
- Critical files modified (auth, payment, database)
- Deletions detected
- Security-related changes
- Database schema changes

## Critical File Patterns

The service flags changes to these patterns as critical:

- `/auth/` - Authentication code
- `/security/` - Security features
- `/payment/` - Payment processing
- `/billing/` - Billing logic
- `/core/` - Core frameworks
- `/engine/` - Core engines
- `/database/` - Database code
- `/schema/` - Database schema
- `/migration/` - Database migrations

## Integration with CI/CD

### GitHub Actions Example

```yaml
- name: Analyze Test Impact
  run: |
    curl -X POST http://localhost:3000/api/impact/analyze \
      -H "Content-Type: application/json" \
      -d '{
        "projectId": "repo-name",
        "changes": '${{ env.CHANGES }}'
      }'

- name: Run Affected Tests
  run: npm test -- ${{ env.AFFECTED_TESTS }}
```

## Performance

- **Coverage Updates**: O(n) where n = files covered
- **Impact Analysis**: O(m × n) where m = changes, n = files
- **Graph Building**: O(n + e) where n = nodes, e = edges
- **In-Memory Storage**: Suitable for projects up to 10K tests

## Testing

Run tests:
```bash
npm test -- ImpactAnalyzer.test.ts
```

## Future Enhancements

- Database persistence for coverage history
- Machine learning for failure probability
- Cross-test dependency detection
- Historical impact trends
- Integration with bug tracking systems
- Visual impact graphs
- Flakiness detection and filtering

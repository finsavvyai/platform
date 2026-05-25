# Qestro Score Badge System - Quick Start

## Calculating Project Score

```typescript
import { scoreCalculator } from './qestro-score/ScoreCalculator.js';
import { badgeGenerator } from './qestro-score/BadgeGenerator.js';

// 1. Calculate with custom metrics
const score = await scoreCalculator.calculateScore('proj-123', {
  testCoveragePercent: 85,
  testPassRate: 98,
  flakinessRate: 2,
  meanTimeToFix: 12,
  pipelineReliability: 0.99,
  deployFrequency: 10,
  lintScore: 90,
  typeScoreCoverage: 88,
  codeComplexity: 6,
  avgTestTime: 2000,
  p95TestTime: 4500
});

// Returns:
// {
//   projectId: 'proj-123',
//   totalScore: 87.5,
//   grade: 'B',
//   breakdown: {
//     coverage: 21,    // 85% of 25
//     health: 23,      // Combined pass rate, flakiness, MTTR
//     cicd: 19,        // Pipeline reliability + deploy frequency
//     quality: 13,     // Lint, types, complexity
//     performance: 12  // Test times
//   },
//   trend: {
//     direction: 'up',
//     changePercent: 2.3,
//     previousScore: 85.5,
//     daysToAnalyze: 7
//   },
//   lastUpdated: Date
// }

// 2. Get current score
const latest = await scoreCalculator.getLatestScore('proj-123');

// 3. Get score history (last 30 days)
const history = await scoreCalculator.getHistory('proj-123', 30);
// Returns: QestroScore[] with timestamps
```

## Generating Badges

```typescript
// SVG Badge (Shields.io compatible)
const svg = badgeGenerator.generateBadge(score, {
  format: 'svg',
  style: 'flat',      // or 'flat-square'
  includeGrade: true  // Shows "87.5/100 B"
});
// Returns: <svg>...</svg>

// Markdown syntax
const markdown = badgeGenerator.generateMarkdown('proj-123', score);
// Returns: [![Qestro Score](...)(...)](...)

// HTML embed code
const html = badgeGenerator.getEmbedCode('proj-123', 'https://qestro.dev');
// Returns: <!-- Qestro Score Badge --><a href="..."><img src="..." /></a>

// JSON metadata
const metadata = badgeGenerator.generateMetadata(score);
// Returns: { projectId, score, grade, color, lastUpdated }
```

## API Endpoints

```bash
# Get latest score
GET /api/score/proj-123
# Auth: Required

# Calculate with metrics
POST /api/score/proj-123/calculate
{
  "testCoveragePercent": 85,
  "testPassRate": 98,
  "avgTestTime": 2500
}

# Get SVG badge (public, no auth)
GET /api/score/proj-123/badge.svg?style=flat&includeGrade=true

# Get badge metadata
GET /api/score/proj-123/badge.json
# Auth: Required

# Get score history
GET /api/score/proj-123/history?days=30
# Auth: Required

# Get embed code
GET /api/score/proj-123/embed?format=markdown&baseUrl=https://qestro.dev
# Returns: { code: "...", type: "markdown" }

# Get score breakdown
GET /api/score/proj-123/breakdown
# Returns: { breakdown: {...}, weights: {...} }

# Force recalculation
POST /api/score/proj-123/recalculate
{ "testCoveragePercent": 90, ... }

# Clear history
DELETE /api/score/proj-123/history
```

## Score Components & Weights

```
Coverage (25%)
  = (testCoveragePercent / 100) * 25

Health (25%)
  = pass_rate (0-10) + flakiness (0-15) + mttr (0-5)

CI/CD (20%)
  = reliability (0-10) + deploy_frequency (0-10)

Quality (15%)
  = lint_score (0-5) + type_coverage (0-5) + complexity (0-5)

Performance (15%)
  = avg_test_time (0-10) + p95_test_time (0-5)

Total = 100 points
```

## Letter Grades

```
A: 90-100  (Green: #28a745)
B: 80-89   (Blue: #0275d8)
C: 70-79   (Yellow: #ffc107)
D: 60-69   (Orange: #fd7e14)
F: <60     (Red: #dc3545)
```

## Markdown Badge Example

```markdown
# My Project

[![Qestro Score](https://qestro.dev/api/score/proj-123/badge.svg)](https://qestro.dev/projects/proj-123)

Project quality: 87.5/100 (Grade B)
```

## HTML Embed Example

```html
<!-- Qestro Score Badge -->
<a href="https://qestro.dev/projects/proj-123">
  <img src="https://qestro.dev/api/score/proj-123/badge.svg" alt="Qestro Score" />
</a>
```

## Using Default Metrics

```typescript
// Calculate with defaults (useful for initial scores)
const score = await scoreCalculator.calculateScoreFromDefaults('proj-123');

// Override specific metrics
const score2 = await scoreCalculator.calculateScoreFromDefaults('proj-123', {
  testCoveragePercent: 75,
  testPassRate: 92
});
// Other metrics use defaults: 65% coverage, 95% pass rate, etc.
```

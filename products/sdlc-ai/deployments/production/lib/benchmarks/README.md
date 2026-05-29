# Performance Benchmarking System

This module provides comprehensive performance benchmarking capabilities for the SDLC.ai production deployment, measuring API endpoint latency, RAG query performance, and vector search performance against defined targets.

## Requirements

- **14.1**: Execute performance benchmarks on API endpoints
- **14.2**: Measure API response time with target of 100ms (p95)
- **14.3**: Measure RAG query response time with target of 500ms (p95)
- **14.4**: Measure vector search latency with target of 150ms (p95)
- **14.5**: Log warning if performance benchmarks fail to meet targets

## Components

### 1. API Benchmarker (`api-benchmarker.js`)

Measures API endpoint latency and calculates response time statistics.

**Features:**
- Configurable warmup and benchmark iterations
- Latency measurement (average, median, p50, p95, p99)
- Success rate tracking
- Standard deviation calculation
- Target comparison

**Usage:**
```javascript
const { APIBenchmarker } = require('./benchmarks');

const benchmarker = new APIBenchmarker({
  iterations: 10,
  targetLatency: 100 // ms
});

const result = await benchmarker.benchmarkEndpoint('https://api.example.com/health', {
  method: 'GET'
});

console.log(`Average Latency: ${result.statistics.average}ms`);
console.log(`P95 Latency: ${result.statistics.p95}ms`);
console.log(`Success Rate: ${result.successRate}%`);
console.log(`Meets Target: ${result.meetsTarget}`);
```

### 2. RAG Benchmarker (`rag-benchmarker.js`)

Measures RAG query latency and verifies response accuracy.

**Features:**
- RAG-specific query benchmarking
- Response time statistics
- Accuracy verification against expected keywords
- Quality scoring

**Usage:**
```javascript
const { RAGBenchmarker } = require('./benchmarks');

const benchmarker = new RAGBenchmarker({
  iterations: 10,
  targetLatency: 500 // ms
});

const testQueries = [
  {
    query: 'What is the purpose of this system?',
    expectedKeywords: ['secure', 'data', 'learning']
  }
];

const result = await benchmarker.benchmarkRAGQueries(
  'https://rag.example.com',
  testQueries
);

console.log(`Average Latency: ${result.statistics.average}ms`);
console.log(`Accuracy Rate: ${result.accuracyRate}%`);
```

### 3. Vector Search Benchmarker (`vector-search-benchmarker.js`)

Measures vector search latency and verifies search result quality.

**Features:**
- Vector search performance measurement
- Result quality verification
- Relevance score analysis
- Quality scoring (0-100)

**Usage:**
```javascript
const { VectorSearchBenchmarker } = require('./benchmarks');

const benchmarker = new VectorSearchBenchmarker({
  iterations: 10,
  targetLatency: 150, // ms
  topK: 5
});

const testVectors = [
  {
    description: 'Test search 1',
    vector: [/* 1536-dimensional vector */],
    expectedIds: ['doc1', 'doc2']
  }
];

const result = await benchmarker.benchmarkVectorSearch(
  'https://vector.example.com',
  testVectors
);

console.log(`Average Latency: ${result.statistics.average}ms`);
console.log(`Quality Score: ${result.averageQualityScore}`);
```

### 4. Benchmark Orchestrator (`benchmark-orchestrator.js`)

Coordinates execution of all benchmarks and aggregates results.

**Features:**
- Executes all benchmark types
- Aggregates results
- Compares against performance targets
- Generates recommendations
- Exports results to JSON

**Usage:**
```javascript
const { BenchmarkOrchestrator } = require('./benchmarks');

const orchestrator = new BenchmarkOrchestrator({
  apiTargetLatency: 100,
  ragTargetLatency: 500,
  vectorTargetLatency: 150,
  gatewayUrl: 'https://gateway.example.com',
  ragUrl: 'https://rag.example.com',
  vectorUrl: 'https://vector.example.com'
});

const results = await orchestrator.executeBenchmarks({
  apiEndpoints: [
    { url: 'https://api.example.com/health', method: 'GET' }
  ],
  ragQueries: [
    { query: 'Test query', expectedKeywords: ['test'] }
  ]
});

console.log(`Overall Success: ${results.overallSuccess}`);
console.log(`Recommendations: ${results.recommendations.length}`);

// Save results
await orchestrator.saveResults('./benchmark-results.json');
```

## Performance Targets

Based on requirements:

| Metric | Target (p95) | Requirement |
|--------|--------------|-------------|
| API Response Time | 100ms | 14.2 |
| RAG Query Time | 500ms | 14.3 |
| Vector Search Time | 150ms | 14.4 |
| API Success Rate | 99% | 14.5 |
| RAG Success Rate | 95% | 14.5 |
| Vector Success Rate | 95% | 14.5 |

## Statistics Calculated

All benchmarkers calculate the following statistics:

- **Average**: Mean latency across all successful requests
- **Median**: 50th percentile latency
- **Min**: Minimum latency observed
- **Max**: Maximum latency observed
- **P50**: 50th percentile latency
- **P95**: 95th percentile latency (primary target metric)
- **P99**: 99th percentile latency
- **Standard Deviation**: Measure of latency variance

## Integration with Deployment

The benchmark orchestrator is designed to be integrated into the deployment pipeline:

```javascript
// In deploy-orchestrator.js
const { BenchmarkOrchestrator } = require('./lib/benchmarks');

async function runPostDeploymentBenchmarks(deploymentConfig) {
  const orchestrator = new BenchmarkOrchestrator({
    gatewayUrl: deploymentConfig.gatewayUrl,
    ragUrl: deploymentConfig.ragUrl,
    vectorUrl: deploymentConfig.vectorUrl
  });

  const results = await orchestrator.executeBenchmarks();

  if (!results.overallSuccess) {
    logger.warn('Performance benchmarks did not meet all targets');
    logger.warn('Recommendations:');
    results.recommendations.forEach(rec => {
      logger.warn(`  - ${rec.message}`);
    });
  }

  return results;
}
```

## Output Format

### Benchmark Result Structure

```json
{
  "api": {
    "totalEndpoints": 3,
    "endpointsMeetingTarget": 3,
    "averageSuccessRate": "100.00",
    "overallSuccess": true,
    "results": [...]
  },
  "rag": {
    "totalBenchmarks": 1,
    "benchmarksMeetingTarget": 1,
    "averageSuccessRate": "100.00",
    "averageAccuracyRate": "85.00",
    "overallSuccess": true,
    "results": [...]
  },
  "vector": {
    "totalBenchmarks": 1,
    "benchmarksMeetingTarget": 1,
    "averageSuccessRate": "100.00",
    "averageQualityScore": "75.50",
    "overallSuccess": true,
    "results": [...]
  },
  "targetComparison": {
    "api": { "success": true, "percentage": 100 },
    "rag": { "success": true, "percentage": 100 },
    "vector": { "success": true, "percentage": 100 }
  },
  "overallSuccess": true,
  "recommendations": [],
  "duration": 15234,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Error Handling

All benchmarkers handle errors gracefully:

- Network timeouts are caught and recorded
- Failed requests are tracked separately
- Partial failures don't stop the benchmark
- Errors are logged with context
- Results include error counts and messages

## Best Practices

1. **Warmup Iterations**: Always run warmup iterations to avoid cold start penalties
2. **Sufficient Iterations**: Use at least 10 iterations for statistical significance
3. **Realistic Test Data**: Use production-like queries and vectors
4. **Network Conditions**: Run benchmarks from the same network as production traffic
5. **Baseline Comparison**: Compare results against previous benchmarks to detect regressions
6. **Target Adjustment**: Adjust targets based on actual production requirements

## Troubleshooting

### High Latency

If benchmarks show high latency:
- Check network connectivity
- Verify service health
- Review database query performance
- Check for resource contention
- Analyze slow query logs

### Low Success Rate

If success rate is below target:
- Check service error logs
- Verify authentication
- Check rate limiting
- Review timeout settings
- Verify service dependencies

### Poor Quality Scores

If RAG or vector quality is low:
- Review embedding model quality
- Check document chunking strategy
- Verify index configuration
- Adjust retrieval parameters
- Review relevance thresholds

## Future Enhancements

- Continuous benchmarking with trend analysis
- Automated performance regression detection
- Integration with monitoring dashboards
- Comparative benchmarking across environments
- Load testing capabilities
- Percentile-based alerting

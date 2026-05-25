# ClawPipe Benchmark Results

> Generated: 2026-04-09T21:35:33.564Z
> Dataset: 400 prompts (2 passes = 200 unique prompts x 2)

## Key Metrics

| Metric | Value |
|--------|-------|
| Total prompts tested | 400 |
| Booster hit rate (resolved without AI) | **30.0%** |
| Average Packer savings (token reduction) | **4.3643%** |
| Cache hit rate (after second pass) | **35.0%** |
| Estimated cost savings overall | **57.3%** |
| Average pipeline overhead | **0.0218ms** |

## Cost Comparison

| Scenario | Total Cost |
|----------|-----------|
| Direct API calls (no ClawPipe) | $0.11 |
| With ClawPipe pipeline | $0.047 |
| **Savings** | **$0.063** |

## Stage Latency Breakdown

| Stage | Avg Time |
|-------|----------|
| Booster | 0.0125ms |
| Packer | 0.0053ms |
| Cache | 0.0001ms |
| Router | 0.004ms |
| Gateway (mock) | 1206.6705ms |
| **Total** | **422.3592ms** |

## Category Breakdown

| Category | Count | Booster Hits | Cache Hits | Avg Packer Savings | Direct Cost | ClawPipe Cost |
|----------|-------|-------------|------------|-------------------|-------------|---------------|
| boostable | 120 | 120 | 0 | 0% | $0 | $0 |
| packable | 120 | 0 | 60 | 10.1833% | $0.038 | $0.011 |
| simple | 80 | 0 | 40 | 0% | $0 | $0 |
| complex | 80 | 0 | 40 | 0% | $0.072 | $0.036 |

## Cache Performance by Pass

| Pass | Cache Hits | Cache Miss |
|------|-----------|------------|
| Pass 1 (cold) | 0 | 200 |
| Pass 2 (warm) | 140 | 60 |

## Top Routes Selected

| Model | Times Selected |
|-------|---------------|
| anthropic:claude-3-haiku | 140 |

---
name: ll-git-insights
displayName: Luna Git Insights
description: Repository analytics and visualization — commit patterns, contributor stats, code churn, bus factor
version: 1.0.0
category: analysis
agent: luna-task-executor
parameters:
  - name: path
    type: string
    description: "Repository path to analyze (default: current directory)"
    required: false
    default: "."
  - name: period
    type: string
    description: "Analysis period: 7d, 30d, 90d, 1y, all (default: 30d)"
    required: false
    default: "30d"
  - name: format
    type: string
    description: "Output format: report, json, csv, html (default: report)"
    required: false
    default: report
mcp_servers:
  - memory
  - git
  - sequential-thinking
prerequisites:
  - name: git
    check: "git --version"
    install: "Install git from https://git-scm.com"
    optional: false
---

# /git-insights — Repository Analytics and Visualization

Analyze git history for actionable insights. Generates visual reports on commit patterns, contributor stats, code churn, and bus factor. Helps prioritize code reviews and understand project health.

## What It Does

```
/git-insights
    │
    ├── COLLECT: Parse git log, diff-stat, blame
    │   ├── Commit history (messages, authors, dates)
    │   ├── File change frequency (churn)
    │   ├── Lines added/removed per author
    │   ├── Branch/merge patterns
    │   └── Tag and release history
    │
    ├── ANALYZE
    │   ├── Contribution Graph
    │   │   ├── Commits per author per week
    │   │   ├── Active hours heatmap
    │   │   └── Collaboration network
    │   │
    │   ├── Code Churn
    │   │   ├── Most changed files (hotspots)
    │   │   ├── Churn rate over time
    │   │   ├── Files with high churn + low coverage
    │   │   └── Stabilization trends
    │   │
    │   ├── Bus Factor
    │   │   ├── Knowledge concentration per file/module
    │   │   ├── Single-author files (risk)
    │   │   ├── Team knowledge overlap
    │   │   └── Recommended pairing targets
    │   │
    │   └── Velocity
    │       ├── Commits per day/week trend
    │       ├── PR merge time distribution
    │       ├── Release frequency
    │       └── Code review turnaround
    │
    └── OUTPUT
        ├── Markdown report with charts
        ├── JSON data for dashboards
        └── Actionable recommendations
```

## How It Works

1. **Git log parsing**: Extracts full commit history with diffs
2. **Statistical analysis**: Calculates churn, velocity, bus factor
3. **Pattern detection**: Identifies hotspots, bottlenecks, risks
4. **Visualization**: ASCII charts in terminal, HTML for browsers
5. **Recommendations**: Prioritized action items based on data

## Usage

```bash
/git-insights                                        # Current repo, last 30 days
/git-insights --period 90d                           # Last 90 days
/git-insights --path ../lunaos-engine                # Specific repo
/git-insights --format html                          # HTML report
/git-insights --period all --format json             # Full history as JSON
```

## Use Cases

| Use Case | Command |
|----------|---------|
| Project health check | `/git-insights --period 30d` |
| Team productivity | `/git-insights --period 90d --format report` |
| Code review priority | `/git-insights` (focuses on high-churn files) |
| Bus factor analysis | `/git-insights --period all` |
| Sprint retrospective | `/git-insights --period 14d` |

## Output Structure

```
git-insights/
├── report.md              # Full analytics report
├── data.json              # Raw metrics data
│   {
│     "period": "30d",
│     "commits": 142,
│     "authors": 5,
│     "bus_factor": 2.3,
│     "hotspots": ["src/routes/workflows.ts", ...],
│     "velocity": { "avg_commits_per_day": 4.7 }
│   }
├── charts/
│   ├── contribution-graph.txt   # ASCII contribution graph
│   ├── churn-heatmap.txt        # File churn visualization
│   └── velocity-trend.txt       # Commit velocity over time
└── recommendations.md     # Prioritized actions
```

## Key Metrics Explained

| Metric | What It Means | Action If Bad |
|--------|--------------|---------------|
| Bus factor < 2 | Knowledge concentrated | Pair programming, docs |
| Churn > 20 changes/month | Unstable file | Refactor, add tests |
| Single-author files | No review coverage | Assign reviewers |
| Declining velocity | Team slowdown | Remove blockers |
| Long PR merge time | Review bottleneck | Add reviewers, split PRs |

## In Pipes

```bash
/pipe git-insights >> ghost blog "Monthly Project Report"
/pipe git-insights --format json >> pulse >> present "Sprint Retro"
/pipe git-insights >> assert "bus_factor > 2" >> ship
/pipe git-insights >> collab standup >> publish slack
```

## Reference

- Inspired by: https://github.com/abhigyanpatwari/GitNexus
- Git log format: `git log --format='%H|%an|%ae|%at|%s' --numstat`

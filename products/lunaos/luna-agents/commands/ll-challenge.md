---
name: ll-challenge
displayName: Luna Challenge
description: Timed coding challenges with AI judging — earn credits, climb leaderboards
version: 1.0.0
category: community
agent: luna-challenge-runner
parameters:
  - name: difficulty
    type: string
    description: "Challenge difficulty level"
    required: false
    default: medium
    enum: [easy, medium, hard]
  - name: topic
    type: string
    description: "Optional topic filter: algorithms, api-design, refactoring, testing, security, performance"
    required: false
workflow:
  - fetch_challenge
  - start_timer
  - monitor_submission
  - ai_judge_evaluate
  - calculate_score
  - update_leaderboard
output: []
prerequisites: []
---

# Luna Challenge

Timed coding challenges with AI judging, inspired by flow-nexus. Solve real-world coding problems, get evaluated on correctness, performance, code quality, and innovation.

## What This Command Does

1. **Fetch Challenge** — pulls a challenge matching your difficulty and topic preferences
2. **Start Timer** — begins the countdown (easy: 15min, medium: 30min, hard: 60min)
3. **Monitor Submission** — watches for your solution file
4. **AI Judge** — evaluates your submission across four dimensions
5. **Calculate Score** — produces a composite score out of 100
6. **Update Leaderboard** — posts your result to the global leaderboard

## Usage

```
/challenge
/challenge --difficulty easy
/challenge --difficulty hard --topic security
/challenge --topic algorithms
```

## Difficulty Levels

| Level | Time Limit | Complexity | Credits Earned |
|-------|-----------|------------|----------------|
| **Easy** | 15 minutes | Single function, clear spec | 10 credits |
| **Medium** | 30 minutes | Multi-file, edge cases | 25 credits |
| **Hard** | 60 minutes | Architecture, optimization | 50 credits |

## Topics

| Topic | Example Challenges |
|-------|-------------------|
| **algorithms** | Implement a priority queue, graph traversal |
| **api-design** | Design a REST API for a feature, handle pagination |
| **refactoring** | Clean up legacy code, extract patterns |
| **testing** | Write tests for untested code, achieve coverage |
| **security** | Fix vulnerabilities, implement auth flow |
| **performance** | Optimize slow queries, reduce bundle size |

## AI Judge Scoring

Your submission is evaluated on four dimensions:

| Dimension | Weight | What's Evaluated |
|-----------|--------|-----------------|
| **Correctness** | 40% | All test cases pass, edge cases handled |
| **Performance** | 20% | Time/space complexity, no unnecessary work |
| **Code Quality** | 25% | Readability, naming, structure, types |
| **Innovation** | 15% | Creative approach, elegant solution |

## Scoring Breakdown

```
Score = (correctness * 0.4) + (performance * 0.2) 
      + (quality * 0.25) + (innovation * 0.15)

Ranks:
  90-100: Legendary
  75-89:  Expert
  60-74:  Skilled
  40-59:  Apprentice
  0-39:   Novice
```

## Leaderboard

- **Global** — all-time top scorers across all topics
- **Weekly** — resets every Monday, top 10 earn bonus credits
- **Topic** — per-topic rankings for specialization bragging rights
- **Team** — aggregate scores for org/team competitions

## Challenge Flow

```
/challenge --difficulty medium --topic testing
  > Challenge: "Write tests for UserService with 90%+ coverage"
  > Time limit: 30 minutes
  > Files created: .luna/challenges/challenge-2026-04-07/
  > Timer started...

[You write your solution]

  > Submission detected!
  > Judging...
  > Score: 82/100 (Expert)
  >   Correctness: 95/100
  >   Performance: 70/100
  >   Code Quality: 85/100
  >   Innovation: 65/100
  > Credits earned: 25
  > Leaderboard rank: #47 globally
```


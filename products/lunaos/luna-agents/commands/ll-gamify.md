---
name: ll-gamify
displayName: Luna Gamify
description: Turn your codebase into games — code quizzes, team leaderboards, achievement systems, interactive tutorials, escape rooms
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: mode
    type: string
    description: "Mode: quiz (code quiz), leaderboard (team stats), achievements (badges), escape-room (debug challenge), tutorial (interactive), trivia (fun facts)"
    required: true
    prompt: true
  - name: difficulty
    type: string
    description: "Difficulty: easy, medium, hard, expert"
    required: false
    default: medium
mcp_servers:
  - git
  - memory
  - sequential-thinking
  - playwright
  - elevenlabs
  - suno
---

# /gamify — Play With Your Code

Turn your codebase into interactive games, quizzes, challenges, and team competitions. Learn your codebase while having fun.

## Game Modes

### /gamify quiz
```
Code Knowledge Quiz:
├── "What does this function return?" (from your actual code)
├── "Which service handles billing webhooks?"
├── "What's the correct order of middleware?"
├── "Find the bug in this snippet" (real past bugs from git)
├── "What was the last thing deployed?"
├── Score tracking + streak bonuses
├── Sound effects (ElevenLabs)
└── Victory jingle (Suno) when you ace it
```

### /gamify leaderboard
```
Team Leaderboard (from git activity):
├── 🏆 Most PRs merged this sprint
├── 🐛 Most bugs fixed
├── 📝 Most code reviewed
├── 🧪 Best test coverage improvement
├── 🚀 Most features shipped
├── ⚡ Fastest PR turnaround
├── 🎯 Longest green CI streak
├── 🏅 Achievement badges earned
└── Updated live from git history
```

### /gamify achievements
```
Unlock badges as you code:
├── 🎖️ "First Blood" — First commit to the repo
├── 🌅 "Early Bird" — Commit before 7am
├── 🦉 "Night Owl" — Commit after midnight
├── 💯 "Perfectionist" — 100% test coverage on a file
├── 🔥 "On Fire" — 5 PRs merged in one day
├── 🛡️ "Guardian" — Fixed a security vulnerability
├── 🎨 "Pixel Perfect" — Zero visual regression
├── 📚 "Documenter" — Updated docs with every feature
├── 🏗️ "Architect" — Refactored > 1000 lines
├── 🎪 "Full Stack" — Committed to all 10 repos
└── Custom badges definable per project
```

### /gamify escape-room
```
Debug Escape Room:
├── Luna introduces a real bug from your git history
├── You have 10 minutes to find and fix it
├── Hints available (costs points)
├── Difficulty scales with your skill level
├── Leaderboard of fastest solvers
├── Background music (tense soundtrack via Suno)
└── Victory animation when solved
```

### /gamify tutorial
```
Interactive Codebase Tutorial:
├── "Welcome to LunaOS! Let's explore..."
├── Guided tour through architecture
├── Challenges at each stop (mini quizzes)
├── Points for correct answers
├── Narrated by AI voice (ElevenLabs)
├── Perfect for onboarding new team members
└── Completion certificate generated
```

### /gamify trivia
```
Fun Facts About Your Code:
├── "Did you know? This repo has 47,231 lines of code"
├── "The oldest file is auth.ts, created 2 years ago"
├── "Team record: 14 PRs merged in a single day"
├── "Most edited file: Dashboard.tsx (342 commits)"
├── "Longest function: processWorkflow (87 lines)"
├── "Total git commits: 1,847"
└── Presented as animated cards with sound
```

## Usage

```bash
/gamify quiz                                              # Code quiz from your repo
/gamify quiz --difficulty expert                          # Hard mode
/gamify leaderboard                                       # Team rankings
/gamify achievements                                      # Show badges
/gamify escape-room                                       # Debug challenge
/gamify tutorial                                          # Interactive onboarding
/gamify trivia                                            # Fun code facts
```

## In Pipes

```bash
/pipe collab onboard >> gamify tutorial >> gamify quiz     # Onboard with games
/pipe collab retro >> gamify leaderboard >> present sprint # Retro with rankings
/pipe gamify escape-room >> if $solved >> sing "victory!" # Debug then celebrate
```

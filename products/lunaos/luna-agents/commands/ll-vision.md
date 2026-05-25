---
name: ll-vision
displayName: Luna Vision AI
description: Screenshot-to-code and UI analysis — analyze designs, compare implementations, detect regressions
version: 1.0.0
category: ai
agent: luna-glm-vision
parameters:
  - name: action
    type: string
    description: Action (screenshot-to-code, compare, analyze, diff, audit)
    required: true
    prompt: true
  - name: target
    type: string
    description: Screenshot path, URL, or component path
    required: true
    prompt: true
workflow:
  - capture_or_load_screenshot
  - analyze_visual_content
  - generate_code_or_report
  - validate_output
  - generate_vision_report
output:
  - .luna/{current-project}/vision-report.md
prerequisites: []
---

# Luna Vision AI

Visual AI that understands screenshots, designs, and UI implementations.

## What This Command Does

Uses GLM Vision + Nexa RAG to analyze visual content and generate or validate code.

## Actions

| Action | What It Does |
|--------|-------------|
| `screenshot-to-code` | Convert a screenshot/design into React components |
| `compare` | Compare design mockup vs actual implementation |
| `analyze` | Describe what a UI screenshot contains |
| `diff` | Visual diff between two screenshots (before/after) |
| `audit` | Check UI against Apple HIG and brand guidelines |

## Usage

```
/vision screenshot-to-code ./designs/dashboard.png
/vision compare ./designs/login.png http://localhost:3000/login
/vision analyze ./screenshots/error-state.png
/vision diff ./before.png ./after.png
/vision audit http://localhost:3000/dashboard
```

## Architecture

```
Screenshot/Design image
  -> GLM Vision: extract UI structure and content
  -> Nexa RAG: match against existing component patterns
  -> Code Generator: produce React/Tailwind components
  -> Validator: check against brand + HIG rules
```

## Features

- Figma screenshot to React + Tailwind code
- Visual regression detection between deployments
- Accessibility issues visible in screenshots (contrast, sizing)
- Brand consistency checking (colors, fonts, spacing)
- Mobile vs desktop layout comparison

---
name: ll-3d
displayName: Luna 3D
description: Generate 3D models and visualizations — app architecture in 3D, component flowcharts, data flow animations, product mockups
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: what
    type: string
    description: "What to generate: architecture (3D system map), flow (component flowchart), mockup (device mockup), model (3D asset), dashboard (3D data viz)"
    required: true
    prompt: true
  - name: source
    type: string
    description: Source — path to code, component name, or description
    required: false
mcp_servers:
  - tripo-3d
  - stability-ai
  - piapi
  - fal-ai
  - zai-mcp-server
  - playwright
  - git
  - sequential-thinking
---

# /3d — Your Code in Three Dimensions

Visualize your architecture, components, and data flows as interactive 3D models. Generate product mockups, 3D assets, and spatial visualizations.

## Modes

### /3d architecture
```
3D System Architecture:
├── Each service as a 3D node (cube/sphere)
├── API connections as glowing lines
├── Data flow animated along connections
├── Color-coded by service type
│   ├── 🔵 Frontend (Next.js, React)
│   ├── 🟢 API (Hono, Workers)
│   ├── 🟡 Database (D1, KV)
│   ├── 🔴 External (Stripe, Auth)
│   └── 🟣 AI/ML (Agents, RAG)
├── Interactive: rotate, zoom, click nodes
├── Export: .glb, .obj, .html (Three.js)
└── Generated from your actual codebase
```

### /3d flow
```
Component Flowchart (3D):
├── React component tree as 3D graph
├── Props flowing down as animated particles
├── State changes as color pulses
├── Event handlers as connection sparks
├── Zoom into any component for details
├── Export: interactive HTML, PNG, SVG
└── Reads your actual component files
```

### /3d mockup
```
Device Mockups:
├── Your app rendered in 3D devices
│   ├── iPhone 15 Pro
│   ├── MacBook Pro
│   ├── iPad
│   ├── Apple Watch
│   └── Custom device
├── Real screenshots from your running app
├── Multiple angles and perspectives
├── Hero image quality (marketing-ready)
└── Export: PNG (transparent), .glb
```

### /3d mock-api
```
API Visualization:
├── Each endpoint as a 3D node
├── Request/response flow animated
├── Auth middleware as gateway
├── Rate limits as traffic lights
├── Error paths in red
├── Success paths in green
├── Response time as node size
├── Live data from your actual API
└── Export: interactive HTML, PNG
```

### /3d dashboard
```
3D Data Visualization:
├── Metrics as 3D bar/line/scatter charts
├── Real-time data if connected to API
├── Fly-through animation
├── VR-ready export (.glb)
└── Embedded in presentations
```

## Usage

```bash
/3d architecture                                          # Full system in 3D
/3d architecture ./src                                    # Specific directory
/3d flow ./src/components/Dashboard.tsx                   # Component tree
/3d mockup                                                # Device mockups of your app
/3d mock-api                                              # API endpoint visualization
/3d model "futuristic AI agent robot"                     # Custom 3D asset
/3d dashboard                                             # 3D metrics visualization
```

## In Pipes

```bash
/pipe 3d architecture >> present architecture >> share team
/pipe 3d mockup >> imagine hero >> publish producthunt
/pipe 3d flow >> record "component walkthrough" >> publish
/pipe 3d mock-api >> docs >> publish notion
/pipe 3d model "product mascot" >> brand >> video trailer >> publish
```

# CLAUDE.md - LunaOS Studio

This file extends the workspace root policy at:

- `/Users/shaharsolomon/dev/projects/claude.md`

## Product Mission And Target User

- Mission: Provide a visual workflow IDE for building, testing, and deploying AI agent workflows with a drag-and-drop canvas, node inspector, and real-time execution preview.
- Target user: Developers and technical product managers who prefer visual workflow construction over code-first approaches.
- Primary jobs to be done:
  - Build agent workflows visually with a node-based canvas editor
  - Configure node parameters via inspector sidebar
  - Test workflow execution with simulated and live runs
  - Export and version workflows for deployment
  - Browse and install skills from the marketplace

## Product-Specific Architecture Constraints

- Runtime(s): Vite + React 18; deployed to Cloudflare Pages at studio.lunaos.ai
- Core services: `src/main.tsx` entry; pages in `src/` (currently flat); components in `src/components/`; hooks in `src/hooks/`; types in `src/types/`; shared lib in `src/lib/`
- Canvas library: @xyflow/react (ReactFlow v12) for the visual workflow editor
- 3D visualization: Three.js for architecture views; Konva for 2D canvas overlays
- Security: DOMPurify for sanitizing any user-provided HTML/markdown in node descriptions
- Data boundaries: All workflow data fetched from and persisted to engine API; no local database; editor state managed in Zustand stores
- Integration boundaries: Engine API (workflow CRUD, execution), OpenClaw API (skill marketplace)
- Max 200 lines per component; split canvas node types, sidebar panels, and dialog modals into separate files
- TypeScript strict mode; Zod for runtime validation of workflow definitions

### ReactFlow/Canvas-Specific Constraints

- Each custom node type must be a separate file in `src/components/nodes/`
- Node data interfaces must extend a shared `BaseNodeData` type
- Canvas keyboard shortcuts must not conflict with browser defaults
- All canvas interactions must have equivalent keyboard-accessible alternatives
- ReactFlow viewport state must not leak into URL or persistent storage unless explicitly saved

## Product-Specific Test Matrix

- Unit tests: Jest (via `jest.config.js` and `jest.studio.config.ts`); files in `src/__tests__/` and `tests/unit/`
- Integration tests: Jest; files in `tests/integration/`; test workflow builder logic, node serialization, and API client
- E2E/smoke tests: Playwright at `playwright.config.js`; visual regression at `tests/e2e/visual-regression.spec.js`
- Performance: Lighthouse CI via `lighthouserc.js`
- Critical path tests (must remain 100% covered):
  - Workflow serialization/deserialization (JSON round-trip)
  - Node connection validation rules
  - Workflow export and import
  - Authentication gate (redirect to login when unauthenticated)
- Coverage thresholds: >=90% line, >=85% branch (matches root policy)

## Product-Specific Security Controls

- AuthN/AuthZ model: JWT token from engine API stored in memory (not localStorage); redirect to login on 401; no direct secret storage
- Secret management: No API keys or secrets in client bundle; all sensitive operations proxied through engine API
- Input/output validation: DOMPurify on all user-provided HTML; Zod validation on workflow JSON before save; SVG sanitization on imported node icons
- Audit logging requirements: Workflow save, delete, and execute actions logged to engine audit endpoint
- Data retention/privacy constraints: No PII stored client-side; workflow definitions may contain user data and must be encrypted at rest by engine

## Product-Specific Release Checklist

- [ ] CI is green (unit + integration + E2E tests pass)
- [ ] Coverage thresholds met: >=90% line, >=85% branch
- [ ] Security scans have no open Critical/High issues
- [ ] Visual regression snapshots updated and reviewed
- [ ] Lighthouse performance score >= 85
- [ ] ReactFlow canvas loads within 2 seconds on 3G throttle
- [ ] All canvas nodes have aria-labels for screen readers
- [ ] `vite build` succeeds with no TypeScript errors
- [ ] Rollback path verified (previous Pages deployment tagged)
- [ ] Release notes and changelog updated

## Commands

```bash
npm run dev               # Vite dev server at localhost:5173
npm run dev:studio        # Studio-specific Vite config
npm run build             # Production build
npm run test              # Jest unit tests
npm run test:studio       # Studio-specific test suite
npm run test:e2e          # Playwright E2E tests
npm run test:visual       # Visual regression tests
npm run lint              # ESLint
npm run typecheck         # TypeScript check
npm run lighthouse        # Lighthouse CI audit
```

## Local Notes

- This file adds ReactFlow canvas-specific constraints (node isolation, keyboard nav).
- This file adds visual regression testing requirement (stricter than root).
- This file does not weaken any root policy requirement.
- Studio deployed to Cloudflare Pages at studio.lunaos.ai.

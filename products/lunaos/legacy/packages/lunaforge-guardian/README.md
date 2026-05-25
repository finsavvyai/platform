# LunaForge Guardian Mode (Fixed API)

Guardian Mode is now a pure evaluator with an explicit API.

## API

```ts
export interface GuardianAPI {
  evaluate(graph?: ProjectGraph | null): void;
}
```

Host usage:

```ts
const guardian = core.modes.get("guardian") as Mode & GuardianAPI;

guardian.evaluate(); // use ctx.graph
// or:
guardian.evaluate(customGraph);
```

Events emitted:

- `guardian:ready`
- `guardian:summary`    → `{ violationCount }`
- `guardian:violations` → `{ violations }`
- `guardian:error`      → `{ error }`

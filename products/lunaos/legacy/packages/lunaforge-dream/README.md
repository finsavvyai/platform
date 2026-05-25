# LunaForge Dream Mode (Fixed API)

Dream Mode now exposes an explicit API instead of listening on `ctx.on`.

## API

```ts
export interface DreamAPI {
  listRecent(): Promise<void>;
  schedule(intent: DreamIntent): Promise<void>;
  checkStatus(id: string): Promise<void>;
}
```

Host usage:

```ts
const dream = core.modes.get("dream") as Mode & DreamAPI;

await dream.schedule({
  id: "refactor-valagate",
  title: "Refactor Valagate Core",
  description: "...",
  targets: ["services/valagate"],
  rules: { maxFiles: 40, maxDiffLines: 800 }
});
```

Events emitted:

- `dream:ready`
- `dream:status`   → `{ status }`
- `dream:runs`     → `{ runs }`
- `dream:scheduled`→ `{ summary }`
- `dream:runStatus`→ `{ summary }`
- `dream:error`    → `{ error }`

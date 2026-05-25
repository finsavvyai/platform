# LunaForge Parallel Universe Mode (Fixed API)

Parallel Universe Mode now exposes an explicit API instead of listening on `ctx.on`.

## API

```ts
export interface ParallelUniverseAPI {
  translate(req: UniverseRequest): Promise<void>;
}
```

Host usage:

```ts
const uni = core.modes.get("parallel-universe") as Mode & ParallelUniverseAPI;

await uni.translate({
  code: currentFileCode,
  languages: ["rust", "go", "python"]
});
```

Events emitted:

- `parallel-universe:ready`
- `universe:status` → `{ status }`
- `universe:result` → `{ variants }`
- `universe:error`  → `{ error }`

# LunaForge Ritual Mode (Fixed API)

Ritual Mode now exposes an explicit API instead of listening on `ctx.on`.

## API

```ts
export interface RitualAPI {
  register(ritual: RitualDefinition): void;
  list(): RitualDefinition[];
  execute(id: string): Promise<void>;
}
```

Host usage:

```ts
const ritual = core.modes.get("ritual") as Mode & RitualAPI;

ritual.register({
  id: "run-tests",
  name: "Run tests",
  trigger: "manual",
  steps: [...]
});

await ritual.execute("run-tests");
```

Events emitted:

- `ritual:ready`
- `ritual:list`      → `{ rituals }`
- `ritual:status`    → `{ status, id }`
- `ritual:result`    → `{ id, result }`
- `ritual:error`     → `{ error }`

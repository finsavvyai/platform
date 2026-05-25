# LunaForge Mythic Mode (Fixed API)

Mythic Mode now exposes an explicit API instead of listening on `ctx.on`.

## API

```ts
export interface MythicAPI {
  generate(story: MythicStory): Promise<void>;
}
```

Host usage:

```ts
const mythic = core.modes.get("mythic") as Mode & MythicAPI;

await mythic.generate({
  title: "The Treasury Vault",
  text: "Users pass through the identity gate..."
});
```

Events emitted:

- `mythic:ready`
- `mythic:status` → `{ status }`
- `mythic:result` → `{ architecture, diagram, files }`
- `mythic:error`  → `{ error }`

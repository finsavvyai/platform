# LunaForge Galaxy Mode v2

Galaxy Mode turns the project graph into a visual snapshot.

## API

```ts
export interface GalaxyAPI {
  snapshot(graphOverride?: ProjectGraph | null): void;
}
```

Events:

- `galaxy:ready`
- `galaxy:snapshot` → `{ snapshot }`
- `galaxy:error`    → `{ error }`

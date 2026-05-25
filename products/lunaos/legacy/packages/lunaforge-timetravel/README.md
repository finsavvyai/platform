# LunaForge TimeTravel Mode v2

TimeTravel Mode reads commit & file history from `ModeContext` extensions.

## API

```ts
export interface TimeTravelAPI {
  listCommits(): void;
  fileHistory(req: FileHistoryRequest): void;
}
```

Events:

- `timetravel:ready`
- `timetravel:commits`      → `{ commits }`
- `timetravel:fileHistory`  → `{ request, history }`

# LunaForge Autopsy Mode v2

Backend-powered forensic debugger.

## API

```ts
export interface AutopsyAPI {
  analyze(input: AutopsyInput): Promise<void>;
  analyzeFromContext(): Promise<void>;
}
```

Events:

- `autopsy:ready`
- `autopsy:status` → `{ status }`
- `autopsy:report` → `{ report }`
- `autopsy:error`  → `{ error }`

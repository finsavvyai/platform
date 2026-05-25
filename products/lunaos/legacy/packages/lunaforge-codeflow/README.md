# LunaForge CodeFlow Mode v2

CodeFlow Mode computes a project graph traversal from a given entry file.

## API

```ts
export interface CodeFlowAPI {
  analyze(req: CodeFlowRequest, graphOverride?: ProjectGraph | null): void;
}
```

## Events
- `codeflow:ready`
- `codeflow:path`
- `codeflow:error`

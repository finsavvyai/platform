# LunaForge Composer Mode v2

Composer surfaces a service-level orchestra snapshot plus live pulses.

## API

```ts
export interface ComposerAPI {
  snapshot(): void;
  pushRuntimePulses(pulses: RuntimePulse[]): void;
}
```

Events:

- `composer:ready`
- `composer:snapshot` → `{ snapshot }`
- `composer:pulses`   → `{ pulses }`

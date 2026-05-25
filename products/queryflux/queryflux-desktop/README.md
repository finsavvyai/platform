# QueryFlux Desktop

QueryFlux Desktop is the Tauri shell for the QueryFlux product. It uses the native bridge for saved database connections, secure credential storage, query execution, schema access, and natural-language SQL generation through the QueryFlux backend.

## Current Status

- Frontend production build passes.
- Rust/Tauri build passes.
- Debug macOS app and DMG packaging pass.
- Saved connection metadata persists in the app config directory.
- Connection passwords are stored in the operating system credential store.
- Backend URL defaults to `http://127.0.0.1:8080` and can be overridden with `QUERYFLUX_BACKEND_URL`.

## Development

```sh
npm run dev
```

```sh
npm run tauri:dev
```

Use a non-default backend:

```sh
QUERYFLUX_BACKEND_URL=https://api.queryflux.example npm run tauri:dev
```

## Verification

```sh
npm run lint
npm run build
cd src-tauri && cargo check
npm run tauri:build-debug
```

The debug macOS artifacts are generated at:

- `src-tauri/target/debug/bundle/macos/QueryFlux.app`
- `src-tauri/target/debug/bundle/dmg/QueryFlux_1.0.0_aarch64.dmg`

## Production Release Blockers

- Configure a real production backend URL and backend health checks.
- Add updater signing keys and re-enable updater artifact generation.
- Configure macOS signing identity, hardened runtime, entitlements, and notarization.
- Add Windows signing and installer verification.
- Add Linux package verification for AppImage/deb/rpm targets.
- Add desktop smoke tests for connection save, connection test, query execution, and updater checks.

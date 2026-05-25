---
name: ll-ide-plugins
displayName: Luna IDE Plugin Generator
description: Scaffold IDE/editor plugins in parallel — Cursor, Windsurf, Trae, Void, VSCode, all JetBrains IDEs, Zed, Neovim, Xcode, Emacs, Sublime, Fleet — sharing common core
version: 1.0.0
category: tooling
agent: luna-task-executor
parameters:
  - name: targets
    type: string
    description: Comma-separated IDE targets or "all". Options - vscode, cursor, windsurf, trae, void, intellij, webstorm, pycharm, goland, rubymine, phpstorm, rider, clion, datagrip, rustrover, androidstudio, fleet, zed, xcode, neovim, emacs, sublime, vscode-forks, jetbrains-all, all
    required: true
    prompt: true
  - name: plugin_name
    type: string
    description: Base plugin identifier (e.g., "lunaos")
    required: false
    default: lunaos
  - name: features
    type: string
    description: Comma-separated features - chat, inline-completion, command-palette, status-bar, settings-ui, auth, telemetry
    required: false
    default: chat,command-palette,status-bar,auth
workflow:
  - resolve_target_matrix
  - scaffold_shared_core
  - generate_vscode_fork_plugins
  - generate_jetbrains_plugins
  - generate_zed_plugin
  - generate_xcode_plugin
  - generate_neovim_plugin
  - generate_emacs_plugin
  - generate_sublime_plugin
  - generate_fleet_plugin
  - wire_build_pipelines
  - generate_tests
  - write_publish_scripts
output:
  - lunaos-ide-plugins/packages/core/        # shared TS core
  - lunaos-ide-plugins/packages/vscode/      # VSCode + Cursor + Windsurf + Trae + Void
  - lunaos-ide-plugins/packages/jetbrains/   # IntelliJ + all JetBrains IDEs
  - lunaos-ide-plugins/packages/zed/         # Zed (Rust)
  - lunaos-ide-plugins/packages/xcode/       # Xcode (Swift)
  - lunaos-ide-plugins/packages/neovim/      # Lua
  - lunaos-ide-plugins/packages/emacs/       # Elisp
  - lunaos-ide-plugins/packages/sublime/     # Python
  - lunaos-ide-plugins/packages/fleet/       # Kotlin
  - lunaos-ide-plugins/scripts/publish-all.sh
prerequisites: []
---

# Luna IDE Plugin Generator

Scaffold every IDE/editor plugin in one shot. Generates production-ready projects with shared core logic, per-platform adapters, tests, CI, and publish scripts.

## What This Command Does

1. **Resolves target matrix** from `targets` param:
   - `all` → every supported editor
   - `vscode-forks` → vscode, cursor, windsurf, trae, void
   - `jetbrains-all` → intellij, webstorm, pycharm, goland, rubymine, phpstorm, rider, clion, datagrip, rustrover, androidstudio
   - Explicit list → only those

2. **Generates shared core** (`packages/core/`) — TypeScript library with:
   - Engine API client (`apiClient.ts`)
   - Auth manager (OAuth + API key)
   - Chat session state machine
   - Telemetry opt-in
   - Common types + Zod schemas

3. **VSCode-family package** — single codebase, multi-manifest:
   - `package.json` with `engines.vscode` + forks declared in `extensionPack` map
   - `cursor.json`, `windsurf.json`, `trae.json`, `void.json` — fork-specific manifests
   - Activation events, command contributions, webview chat panel
   - Uses shared core via workspace dep
   - Publish: `vsce publish` + OpenVSX + cursor marketplace + windsurf registry

4. **JetBrains package** — single Gradle project, multi-IDE:
   - `plugin.xml` with `<depends>` per IDE (intellij, webstorm, etc.)
   - `build.gradle.kts` with `intellijPlatform { products(...) }` block listing all 11 IDEs
   - Tool window + action group + settings page
   - Kotlin native impl, JNA-bridge to shared core JS runtime (embedded via GraalJS or HTTP to localhost helper)
   - Publish: single ZIP works across all JetBrains products

5. **Zed plugin** (Rust):
   - `Cargo.toml` + `extension.toml`
   - Implements `Extension` trait, language server adapter
   - Publish to Zed extensions registry

6. **Xcode extension** (Swift, macOS only):
   - Source Editor Extension + XPC service
   - Uses shared core via NSTask to Node helper, or native Swift port for critical paths
   - Notarized build via fastlane

7. **Neovim plugin** (Lua):
   - `lua/lunaos/init.lua` entry
   - Telescope extension for command palette
   - Floating window for chat
   - Calls core via local HTTP bridge

8. **Emacs package** (Elisp):
   - `lunaos.el` with autoloads
   - `use-package` ready
   - MELPA recipe

9. **Sublime Text** (Python 3.8):
   - `LunaOS.sublime-package`
   - Command palette + sidebar
   - Package Control manifest

10. **Fleet plugin** (Kotlin):
    - Fleet extension API (separate from IntelliJ Platform)
    - Smart mode + tool window

## Shared Build Pipeline

`scripts/publish-all.sh`:
```bash
pnpm -F core build
pnpm -F vscode publish    # → VSCode Marketplace, OpenVSX, Cursor, Windsurf, Trae, Void
pnpm -F jetbrains publish # → JetBrains Marketplace (all IDEs)
cargo publish -p zed      # → Zed registry
xcrun altool ...           # → Xcode notarization
luarocks upload            # → Neovim
package-lint && melpa PR   # → Emacs
subl-package --publish     # → Package Control
fleet-plugin publish       # → JetBrains Fleet
```

## Features Per Plugin

Each plugin scaffolded with (toggle via `features` param):
- **chat** — Inline chat panel wired to engine API
- **inline-completion** — Tab-accept completions via LSP
- **command-palette** — Luna commands surfaced in native palette
- **status-bar** — Connection + plan status indicator
- **settings-ui** — API key, endpoint, telemetry toggle
- **auth** — OAuth flow with PKCE, token stored in OS keychain
- **telemetry** — Opt-in anonymous usage (Sentry)

## Generated Tests

- **Unit**: shared core (Vitest), per-adapter smoke tests
- **Integration**: VSCode extension host, JetBrains plugin verifier, Zed extension test harness
- **E2E**: Playwright drives each IDE via its CLI/WebDriver where available

## Usage

```
/ll-ide-plugins all                                    # every IDE
/ll-ide-plugins vscode-forks,jetbrains-all             # major families only
/ll-ide-plugins cursor,windsurf,vscode                 # trio
/ll-ide-plugins vscode --features=chat,inline-completion
```

## Notes

- All files <200 lines per portfolio policy.
- Shared core avoids triple-implementation of API calls.
- VSCode family uses one codebase; fork-specific manifests select install targets.
- JetBrains uses one Gradle build; `intellijPlatform.products(...)` declares all 11 IDE SKUs.
- Rust/Swift/Lua/Elisp/Python/Kotlin adapters delegate heavy logic to core via stdio or HTTP bridge to stay DRY.

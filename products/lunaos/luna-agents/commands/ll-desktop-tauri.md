---
name: ll-desktop-tauri
displayName: Luna Desktop Tauri
description: Generate a production Tauri 2.0 + shadcn/ui desktop app scaffold with Apple HIG compliance, native menus, dark/light, code-signed deploy pipeline.
version: 1.0.0
category: design
agent: luna-desktop-tauri
parameters:
  - name: app_name
    type: string
    description: Desktop app name (PascalCase)
    required: true
    prompt: true
  - name: identifier
    type: string
    description: Reverse-DNS bundle id (e.g., ai.lunaos.studio)
    required: true
    prompt: true
  - name: target
    type: string
    description: "macos | windows | linux | all"
    required: false
    default: "all"
  - name: design
    type: string
    description: "hig | fluent | gnome | minimal"
    required: false
    default: "hig"
workflow:
  - scaffold_tauri_2_project
  - install_shadcn_ui
  - apply_design_system
  - configure_native_menus
  - set_up_dark_light_mode
  - configure_code_signing
  - generate_ci_release_pipeline
  - generate_first_window
  - run_dev_smoke_test
output:
  - {app_name}/ (full project tree)
  - {app_name}/.github/workflows/release.yml
  - .luna/{current-project}/desktop-tauri-report.md
prerequisites:
  - rust toolchain (1.78+)
  - node 20+
---

# Luna Desktop Tauri — HIG-Compliant Desktop Scaffold

Generates a production-ready desktop app: Tauri 2.0 (Rust core) + React + shadcn/ui front-end. Apple HIG compliant by default, with Fluent / GNOME / Minimal as alternatives.

## Stack

- **Core**: Tauri 2.0 (Rust, ~600KB binary, no Electron bloat)
- **UI**: React 18 + shadcn/ui + Tailwind CSS
- **State**: Zustand
- **IPC**: Tauri commands (typed via `@tauri-apps/api`)
- **Build**: Vite
- **Sign**: Apple notarization, Windows Authenticode, Linux AppImage

## What Gets Generated

```
{app_name}/
├── src-tauri/                    # Rust backend
│   ├── src/main.rs               # Entry, window setup
│   ├── src/menu.rs               # Native menu bar (HIG-style on macOS)
│   ├── src/commands.rs           # Typed IPC commands
│   ├── tauri.conf.json           # Bundle config, identifiers
│   └── icons/                    # 16x16 → 1024x1024 .icns/.ico
├── src/                          # React front-end
│   ├── App.tsx
│   ├── components/ui/            # shadcn/ui primitives
│   ├── components/layout/        # Sidebar, TitleBar, StatusBar (HIG)
│   ├── lib/theme.ts              # Light/dark with system preference
│   ├── lib/ipc.ts                # Typed Tauri command wrappers
│   └── styles/globals.css        # Tailwind + design tokens
├── .github/workflows/release.yml # Cross-platform signed builds
├── package.json
└── README.md
```

## Apple HIG Compliance (default `--design hig`)

- **Spacing**: 8pt grid, 16pt section gaps
- **Typography**: SF Pro / system-ui, 13/15/17/22 sizes
- **Colors**: semantic tokens (`background`, `foreground`, `accent`, `muted`) — auto dark/light
- **Window chrome**: title bar with traffic lights flush left, transparent title bar on macOS
- **Sidebar**: 220pt wide, blurred-glass material on macOS via `tauri-plugin-acrylic`
- **Touch bar**: not used (deprecated)
- **Keyboard**: ⌘K command palette, ⌘, preferences, ⌘W close, full menu shortcuts
- **Motion**: subtle, 200ms ease-out
- **Accessibility**: focus rings, 4.5:1 contrast, full keyboard nav, VoiceOver labels

## Design System Variants

| `--design` | Style |
|-----------|-------|
| `hig` (default) | macOS Big Sur+ — translucent, rounded, system colors |
| `fluent` | Windows 11 Fluent — Mica/Acrylic, rounded, accent color |
| `gnome` | GNOME Adwaita — flat, sharp dividers, libadwaita-like |
| `minimal` | Cross-platform neutral — flat, no platform-specific materials |

## Native Menus

Generated `src-tauri/src/menu.rs` builds a real native menu bar (not HTML):
- macOS: Application menu, File, Edit, View, Window, Help
- Windows: File, Edit, View, Window, Help
- Linux: same; rendered via libappindicator

Each menu item wired to a Tauri command + JS event listener in `src/lib/ipc.ts`.

## Code Signing & Release

`.github/workflows/release.yml`:
- macOS: import cert from `MACOS_CERTIFICATE` secret, notarize via `MACOS_NOTARIZE_*`
- Windows: sign with `WINDOWS_CERTIFICATE_PFX_BASE64`
- Linux: build AppImage + .deb + .rpm
- Tags trigger release (`v*`) → uploads to GitHub Release

## Usage

```
/ll-desktop-tauri MyApp ai.example.myapp                  # default HIG, all platforms
/ll-desktop-tauri MyApp ai.example.myapp --target macos   # macOS only
/ll-desktop-tauri MyApp ai.example.myapp --design fluent  # Windows-style
```

## Output

- Full project tree at `./{app_name}/`
- `.luna/{project}/desktop-tauri-report.md` — what was generated, next steps, signing setup checklist

## After Generation

```
cd {app_name}
npm install
npm run tauri dev    # opens window
npm run tauri build  # produces signed artifacts (with secrets configured)
```

## Rules

- Max 200 lines per source file (split when bigger)
- All UI text in `src/i18n/en.json` for future localization
- No raw HTML drag regions — use `data-tauri-drag-region` correctly
- Always test on the target OS (the agent will ask user to confirm)

## In Pipes

```bash
/pipe idea "desktop app" >> ll-desktop-tauri MyApp com.x.y >> hig >> ship
/pipe ll-desktop-tauri MyApp x.y --design hig >> ll-cache-tune (if Claude integration)
```

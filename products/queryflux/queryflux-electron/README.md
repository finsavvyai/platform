# QueryFlux Electron

A robust, production-grade Electron application for QueryFlux - the AI-powered database management platform.

## 🚀 Features

- **Modern Electron 33+** with electron-vite for fast development
- **Secure IPC Architecture** with context isolation and preload scripts
- **Native Credential Storage** via keytar (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Auto-Updater** with GitHub Releases integration
- **System Tray** support with quick actions
- **Cross-Platform** builds for macOS, Windows, and Linux
- **Premium UI** with dark mode, glassmorphism, and smooth animations

## 📦 Project Structure

```
queryflux-electron/
├── src/
│   ├── main/           # Main process (Electron)
│   │   ├── index.ts    # App entry point
│   │   ├── ipc/        # IPC handlers
│   │   ├── store.ts    # Electron store
│   │   └── tray.ts     # System tray
│   ├── preload/        # Preload scripts
│   │   └── index.ts    # Context bridge APIs
│   ├── renderer/       # React frontend
│   │   ├── index.html
│   │   └── src/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── hooks/
│   │       └── styles/
│   └── shared/         # Shared types
│       └── types.ts
├── resources/          # Build resources (icons, etc.)
├── electron.vite.config.ts
├── package.json
└── tsconfig.json
```

## 🛠️ Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Building

```bash
# Build for current platform
npm run dist

# Build for specific platforms
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## 🔐 Security

- **Context Isolation**: Renderer process has no direct access to Node.js APIs
- **Preload Scripts**: Only explicitly exposed APIs are available to the renderer
- **Secure Credential Storage**: Passwords are stored in the OS keychain, never in plain text
- **Content Security Policy**: Strict CSP headers prevent XSS attacks

## 📡 IPC API

The preload script exposes a typed API to the renderer:

```typescript
// Connection management
window.api.connection.save(config)
window.api.connection.getAll()
window.api.connection.test(config)

// Query execution
window.api.query.execute(request)

// Schema introspection
window.api.schema.get(connectionId)

// AI features
window.api.ai.naturalToSql(connectionId, text)
```

## 🎨 UI Components

Built with React 18 and a custom design system featuring:
- Collapsible sidebar navigation
- Query editor with syntax highlighting
- Schema browser
- Connection management
- Settings panel

## 📝 Configuration

Application settings are stored using `electron-store`:
- Window state and position
- Theme preferences
- Editor settings
- Recent queries

## 🔄 Auto-Updates

Uses `electron-updater` to check for updates from GitHub Releases:
- Automatic update checks on startup
- Manual check via Help menu
- Seamless installation

## 📄 License

MIT

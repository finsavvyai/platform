# QueryFlux Desktop Application

QueryFlux Desktop is an AI-powered database management application built with Electron, React, and TypeScript. It provides native database connections, secure local storage, and advanced query capabilities with AI assistance.

## Features

- **Multi-Database Support**: Connect to PostgreSQL, MySQL, MongoDB, Redis, SQLite, SQL Server, Oracle, and Cassandra
- **AI-Powered Query Assistance**: Natural language to SQL conversion, query optimization, and explanations
- **Secure Local Storage**: Your data stays on your device with enterprise-grade encryption
- **Real-time Monitoring**: Monitor database performance and metrics in real-time
- **Cross-Platform**: Available for macOS, Windows, and Linux

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Getting Started

1. Clone the repository and navigate to the electron directory:
```bash
cd electron
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

This will start both the Vite development server and the Electron app in watch mode.

### Build Commands

```bash
# Development
npm run dev:main        # Watch main process
npm run dev:renderer    # Start Vite dev server

# Build
npm run build           # Build all processes
npm run build:main      # Build main process only
npm run build:renderer  # Build renderer process only
npm run build:preload   # Build preload script only

# Distribution
npm run dist            # Build and package for current platform
npm run dist:all        # Build for all platforms
npm run dist:mac        # Build for macOS
npm run dist:win        # Build for Windows
npm run dist:linux      # Build for Linux

# Development tools
npm run typecheck       # TypeScript type checking
npm run lint            # ESLint
npm run lint:fix        # Fix ESLint issues
npm run clean           # Clean build artifacts
```

## Project Structure

```
electron/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts    # Main entry point
│   ├── preload/        # Preload script
│   │   └── index.ts    # IPC bridge
│   └── renderer/       # React frontend
│       ├── App.tsx     # Main React component
│       ├── main.tsx    # React entry point
│       ├── index.html  # HTML template
│       └── styles/     # CSS styles
├── dist/               # Build output
├── release/            # Packaged applications
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── tsconfig.preload.json
├── tsconfig.node.json
├── vite.config.ts
└── electron.vite.config.ts
```

## Architecture

### Main Process
- Handles window management
- Manages secure storage with electron-store
- Implements IPC handlers for database operations
- Provides native menu and system integration

### Preload Script
- Secure bridge between main and renderer processes
- Type-safe API definitions
- Context isolation for security

### Renderer Process
- React application with TypeScript
- Material Design-inspired UI
- Real-time data visualization
- Voice command interface

## Security Features

- **Context Isolation**: Renderer process is sandboxed
- **Node Integration Disabled**: Prevents direct Node.js access
- **Secure IPC**: Validated communication channels
- **Encrypted Storage**: Sensitive data encrypted at rest
- **Content Security Policy**: Prevents XSS attacks

## Database Drivers

The application includes native database drivers:

- PostgreSQL: `pg` (8.11.3)
- MySQL: `mysql2` (3.6.5)
- MongoDB: `mongodb` (6.3.0)
- Redis: `ioredis` (5.3.2)
- SQL Server: `tedious` (16.7.1)
- Oracle: `oracledb` (6.3.0)
- Cassandra: `cassandra-driver` (4.6.4)
- SQLite: `better-sqlite3` (8.7.0)

## Build Configuration

### macOS
- Target: DMG, MAS (Mac App Store)
- Architecture: x64, arm64
- Code signing: Enabled
- Hardened runtime: Enabled

### Windows
- Target: NSIS installer, APPX (Microsoft Store)
- Architecture: x64, ia32
- Code signing: Configurable

### Linux
- Target: AppImage, DEB, RPM
- Architecture: x64
- Category: Development

## Environment Variables

Create a `.env` file for development:

```env
# Application
NODE_ENV=development

# AI Services (optional)
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key

# Database (for development testing)
DATABASE_URL=postgresql://user:password@localhost:5432/queryflux
```

## Troubleshooting

### Common Issues

1. **Build fails on macOS**
   - Ensure Xcode Command Line Tools are installed
   - Check code signing certificates in Keychain Access

2. **Database connection issues**
   - Verify database drivers are installed
   - Check firewall and network connectivity
   - Ensure database is accessible from the application

3. **Development server not starting**
   - Check if port 5174 is available
   - Clear node_modules and reinstall dependencies

### Debug Mode

Enable debug logging:
```bash
DEBUG=queryflux:* npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run linting and type checking
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: https://docs.queryflux.com
- Issues: https://github.com/queryflux/queryflux/issues
- Discussions: https://github.com/queryflux/queryflux/discussions
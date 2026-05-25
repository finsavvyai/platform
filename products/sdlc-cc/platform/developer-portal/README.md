# SDLC.ai Developer Portal

Enterprise-grade developer portal for the SDLC.ai platform with interactive API playground, comprehensive documentation, and developer resources.

## Features

### 🎯 Interactive Playground
- Real-time API testing with live endpoints
- Request/response visualization
- Multiple endpoints support (RAG, Documents, Users)
- Code generation and examples
- Authentication configuration

### 📚 Comprehensive Documentation
- Multi-language SDK documentation
- API reference with examples
- Authentication guides
- Security and compliance documentation
- Real-time features documentation

### 🚀 Getting Started
- Quick start guides
- Language-specific installation instructions
- Step-by-step tutorials
- Best practices and patterns

### 💻 Code Examples
- Real-world implementation examples
- Multiple programming languages
- Enterprise integration patterns
- Web application examples
- Batch processing examples

### 🎨 Modern UI/UX
- Responsive design for all devices
- Dark/light theme support
- Searchable documentation
- Interactive code examples
- Professional developer experience

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with Radix UI components
- **Code Editor**: Monaco Editor (VS Code editor)
- **Icons**: Lucide React
- **Markdown**: React Markdown with syntax highlighting

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/sdlc-ai/developer-portal
cd developer-portal

# Install dependencies
npm install

# Start development server
npm run dev
```

The development server will start at `http://localhost:3000`

### Build for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_NAME=SDLC.ai Developer Portal
VITE_APP_VERSION=1.0.0
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base UI components (Button, Card, etc.)
│   ├── Navigation.tsx  # Main navigation component
│   └── Footer.tsx      # Footer component
├── pages/              # Page components
│   ├── HomePage.tsx    # Landing page
│   ├── PlaygroundPage.tsx # Interactive API playground
│   ├── DocumentationPage.tsx # Documentation
│   ├── ExamplesPage.tsx     # Code examples
│   └── GettingStartedPage.tsx # Getting started guide
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── types/              # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## API Integration

The developer portal integrates with the SDLC.ai API Gateway:

- **Base URL**: Configurable via environment variables
- **Authentication**: Bearer token authentication
- **Endpoints**: RAG queries, document management, user operations
- **Real-time**: WebSocket support for streaming responses

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@sdlc.cc
- 💬 Discord: [Join our community](https://discord.gg/sdlc-ai)
- 📖 Documentation: [Full documentation](https://docs.sdlc.cc)
- 🐛 Issues: [Report issues](https://github.com/sdlc-ai/developer-portal/issues)

## Security

If you discover a security vulnerability, please send an email to security@sdlc.cc instead of opening an issue.

---

Built with ❤️ by the SDLC.ai team
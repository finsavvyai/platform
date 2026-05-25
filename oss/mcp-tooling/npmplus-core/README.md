# NPM Plus Core - Free Community Edition

A free, open-source MCP (Model Context Protocol) server for essential JavaScript package management in AI editors. Created by [Shachar Solomon](https://github.com/shacharsol).

## 🆓 What's Included (8 Essential Tools)

### 🔍 Package Search & Info
- **search_packages** - Search npm registry with relevance scoring
- **package_info** - Get detailed package information and metadata

### 📦 Package Management  
- **install_packages** - Install packages (with dev/global options)
- **update_packages** - Update packages to latest versions
- **remove_packages** - Remove unwanted packages
- **check_outdated** - Check for outdated dependencies

### 🛠️ Basic Utilities
- **check_license** - Check specific package license
- **clean_cache** - Clean package manager caches

## 🚀 Quick Start

### Hosted Service (Recommended)
```json
{
  "mcpServers": {
    "npmplus-core": {
      "transport": "http",
      "url": "https://api.npmplus.dev/core"
    }
  }
}
```

### Self-Hosting
```bash
git clone https://github.com/shacharsol/npmplus-core.git
cd npmplus-core
npm install
npm run build
npm start
```

## 🎯 Perfect For

- **Personal Projects** - Essential package management for individual developers
- **Learning** - Great for understanding MCP and package management
- **Open Source Projects** - Free tier for community projects
- **Proof of Concepts** - Quick setup for testing AI package management

## 💡 Example Usage

Ask your AI assistant:
- *"Search for React testing libraries"*
- *"Install express as a dependency"* 
- *"Check if lodash package has a MIT license"*
- *"Update all my outdated packages"*
- *"What's the latest version of typescript?"*

## 🔄 Upgrade to Pro

Need more advanced features? Upgrade to [NPM Plus Pro](https://npmplus.dev/pro) for:

- **🔒 Security Tools** - Vulnerability scanning & auditing
- **📊 Analytics** - Bundle size analysis & dependency insights  
- **📜 Compliance** - License analysis across all dependencies
- **⚡ Enhanced Performance** - Higher rate limits & priority support
- **🏢 Enterprise Support** - SLA guarantees & custom integrations

[Compare all tiers →](https://npmplus.dev/pricing)

## 🛠️ Editor Setup

### Claude Desktop
**File:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
```json
{
  "mcpServers": {
    "npmplus-core": {
      "transport": "http",
      "url": "https://api.npmplus.dev/core"
    }
  }
}
```

### Windsurf
**File:** `.windsurfrc` (project root)
```json
{
  "mcp": {
    "servers": {
      "npmplus-core": {
        "transport": "http",
        "url": "https://api.npmplus.dev/core"
      }
    }
  }
}
```

### Cursor & VS Code
Add to your MCP settings or create a `.cursorrules` file with the server configuration.

[Full setup guide →](https://npmplus.dev/docs)

## 🏗️ Architecture

- **TypeScript** for type safety and modern development
- **MCP SDK** for protocol implementation  
- **Zod** for robust input validation
- **Execa** for secure package manager execution
- **Node-cache** for intelligent response caching

## 📊 Usage Limits (Free Tier)

- **Rate Limit:** 500 requests/hour per IP
- **Tools:** 8 essential package management tools
- **Support:** Community support via GitHub issues
- **Self-Hosting:** Unlimited (MIT license)

## 🤝 Contributing

We welcome contributions! This is the community edition - help make it better:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development
```bash
npm run dev      # Development mode with hot reload
npm test         # Run test suite
npm run build    # Build for production
npm run lint     # Code linting
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

Free for personal and commercial use, including self-hosting.

## 🌟 NPM Plus Ecosystem

- **NPM Plus Core** (this repo) - Free community edition
- **[NPM Plus Pro](https://npmplus.dev/pro)** - Advanced security & analytics
- **[NPM Plus Enterprise](https://npmplus.dev/enterprise)** - Full-featured with support
- **[Documentation](https://npmplus.dev/docs)** - Comprehensive guides
- **[Website](https://npmplus.dev)** - Official home

## 🔗 Links

- 🌐 **Website:** [npmplus.dev](https://npmplus.dev)
- 📚 **Documentation:** [npmplus.dev/docs](https://npmplus.dev/docs)
- 💬 **Support:** [GitHub Issues](https://github.com/shacharsol/npmplus-core/issues)
- 🐦 **Updates:** Follow [@FinsavviAI](https://twitter.com/FinsavviAI)

---

**Made with ❤️ by [Shachar Solomon](https://github.com/shacharsol) • 2025**

*Empowering developers with AI-powered package management*
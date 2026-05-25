# 🌙 LunaForge

**AI-Powered Code Intelligence Platform for Visual Studio Code**

> Transform complex codebases into actionable insights with enterprise-grade AI analysis

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue.svg)](https://marketplace.visualstudio.com/items?itemName=lunaforge.lunaforge)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.4.0-orange.svg)](https://github.com/lunaforge/lunaforge)

---

## ✨ Features

### 🧠 **AI-Powered Analysis**
- **12 Analysis Modes**: Galaxy, CodeFlow, TimeTravel, Autopsy, Composer, Prophecy, ParallelUniverse, Guardian, Ritual, Dream, Mythic
- **25 Professional Commands**: Complete code analysis toolkit
- **Smart Recommendations**: AI-powered improvement suggestions
- **Real-time Insights**: Live code understanding and visualization

### 🎯 **Professional Tools**
- **Interactive Graph Visualization**: Beautiful dependency graphs with real-time updates
- **Advanced Filtering**: Focus on what matters with powerful filters
- **Export Capabilities**: JSON, DOT, SVG, CSV export formats
- **Enterprise Security**: Secure analysis with compliance features

### 🚀 **Performance**
- **Lightning Fast**: Analyze 10,000+ files in seconds
- **Memory Efficient**: Optimized for large codebases
- **Concurrent Processing**: Multi-threaded analysis
- **Smart Caching**: Intelligent result caching

---

## 📦 Architecture

LunaForge uses a **Core vs Premium** model with local and cloud-powered features:

### 🔷 Core Features (Local / Free)
Run entirely within VS Code with no external dependencies:

```
packages/
├── lunaforge-extension/     # VS Code extension
├── lunaforge-core/         # Core analysis engine
├── lunaforge-galaxy/       # 3D dependency visualization
├── lunaforge-guardian/     # Architecture rules & linting
├── lunaforge-codeflow/     # Code path analysis
└── lunaforge-timetravel/   # Git history integration
```

### 🔶 Premium Features (Cloud / Paid)
AI-powered analysis backed by Cloudflare Workers:

```
packages/
├── lunaforge-dream/            # AI code generation
├── lunaforge-mythic/           # Story-to-architecture AI
├── lunaforge-autopsy/          # Deep debugging analysis
├── lunaforge-prophecy/         # Predictive insights
└── lunaforge-parallel-universe/ # Code translation

workers/
└── agent-brain/               # Backend LLM orchestration
```


---

## 🚀 Quick Start

### Installation

**From VS Code Marketplace:**
1. Open VS Code
2. Press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (macOS)
3. Search for "LunaForge"
4. Click **Install**

**From Command Line:**
```bash
code --install-extension lunaforge.lunaforge
```

### Basic Usage

1. **Open Command Palette**: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. **Type "LunaForge"** to see all available commands
3. **Try "LunaForge: Build Project Graph"** to get started
4. **Open Control Center** with "LunaForge: Open Control Center"

### Key Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `LunaForge: Build Project Graph` | `Ctrl+L Ctrl+G` | Analyze your project |
| `LunaForge: Open Control Center` | `Ctrl+L Ctrl+C` | Open main dashboard |
| `LunaForge: Export Graph` | `Ctrl+L Ctrl+E` | Export analysis results |
| `LunaForge: Refresh Graph` | `Ctrl+L Ctrl+R` | Refresh analysis |

---

## 💎 Premium Features

### 🔥 **Free Tier**
- Up to 1,000 files per project
- 1 analysis per day
- Basic visualization
- Community support

### 🚀 **Professional ($29/month)**
- Unlimited project size
- All 12 analysis modes
- AI-powered recommendations
- Advanced export options
- Priority support

### 🏢 **Enterprise ($99/month)**
- All Professional features
- Team collaboration (up to 25 users)
- Advanced security features
- API access
- Dedicated support

---

## 📚 Documentation

- **[Publishing Guide](docs/PUBLISHING-GUIDE.md)** - How to publish LunaForge
- **[Market Analysis](docs/COMPETITIVE-ANALYSIS-REPORT.md)** - Competitive intelligence
- **[Launch Strategy](docs/LAUNCH-EXECUTION-PLAN.md)** - Go-to-market strategy
- **[Testing Guide](docs/LUNAFORGE-FLOW-TEST-REPORT.md)** - Testing and verification

---

## 🛠 Development

### Setup

```bash
# Clone the repository
git clone https://github.com/lunaforge/lunaforge.git
cd lunaforge

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Project Structure

```
lunaforge/
├── packages/          # All packages
├── scripts/           # Build and test scripts
├── docs/             # Documentation
├── .vscode/          # VS Code configuration
└── workers/          # Web workers for analysis
```

### Scripts

- `npm run build` - Build all packages
- `npm run test` - Run all tests
- `npm run package` - Create VSIX package
- `npm run publish` - Publish to marketplace

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **VS Code Team** - For the excellent extension API
- **TypeScript Team** - For the amazing type system
- **Our Community** - For feedback and suggestions

---

## 📞 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/lunaforge/lunaforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/lunaforge/lunaforge/discussions)
- **Email**: support@lunaos.ai

---

## 🌟 Roadmap

### Version 0.2.0 (Next)
- [ ] Enhanced AI recommendations
- [ ] Team collaboration features
- [ ] Advanced export formats
- [ ] Performance optimizations

### Version 1.0.0 (Future)
- [ ] lunaos.ai web platform
- [ ] Enterprise integrations
- [ ] Custom AI models
- [ ] API platform

---

🌙 **Built with ❤️ by the LunaForge team**

*Transform how developers understand code, one project at a time.*
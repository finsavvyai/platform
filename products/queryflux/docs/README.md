# QueryFlux Documentation

Welcome to the QueryFlux documentation hub. QueryFlux is an AI-native database workspace for builders shipping apps with agents.

## 🚀 Quick Start

- **[Main README](../README.md)** - Project overview and getting started
- **[Environment Setup](../ENVIRONMENT_SETUP.md)** - Development environment configuration
- **[CLAUDE Instructions](../CLAUDE.md)** - AI assistant development guidelines

## 📚 Documentation Categories

### 🏗️ **Deployment**
Production deployment guides and infrastructure setup:
- **[Cloudflare Deployment](deployment/CLOUDFLARE_DEPLOYMENT_GUIDE.md)** - Cloudflare Pages deployment
- **[Custom Domain](deployment/CUSTOM_DOMAIN_DEPLOYMENT.md)** - Custom domain configuration
- **[Full Production Guide](deployment/FULL_PRODUCTION_DEPLOYMENT_GUIDE.md)** - Complete production deployment
- **[Production Summary](deployment/PRODUCTION_DEPLOYMENT_SUMMARY.md)** - Production deployment overview

### ⚡ **Features**
Feature documentation and capabilities:
- **[Features Overview](features/FEATURES.md)** - Complete feature list
- **[DBA Features](features/DBA_FEATURES.md)** - Database administrator tools
- **[AI Database Integration](features/AI_DATABASE_INITIALIZATION.md)** - AI-powered database features
- **[Apple HIG Implementation](features/APPLE_HIG.md)** - Apple Human Interface Guidelines design system

### 🎯 **Strategy**
Business and product strategy documents:
- **[Vibecoding Product Vision](strategy/VIBECODING_PRODUCT_VISION.md)** - Canonical product direction for web, desktop, mobile, and MCP
- **[Competitive Strategy](strategy/COMPETITIVE_DOMINATION_STRATEGY.md)** - Market positioning
- **[Marketing Strategy](strategy/MARKETING_SUBSCRIPTION_STRATEGY.md)** - Marketing and subscription approach
- **[TablePlus Strategy](strategy/TABLEPLUS_DOMINATION_STRATEGY.md)** - Competitive analysis
- **[Product Roadmap](strategy/QUERYFLUX_ROADMAP.md)** - Development roadmap

### 🔧 **Technical**
Technical architecture and implementation:
- **[Technical Specifications](technical/TECHNICAL_SPECS.md)** - Technical architecture
- **[Shared Product Contract](technical/SHARED_PRODUCT_CONTRACT.md)** - Web, desktop, mobile, and MCP contract boundary
- **[Secure Electron Architecture](technical/SECURE_ELECTRON_ARCHITECTURE.md)** - Desktop app security
- **[Backend Implementation Plan](../BACKEND_IMPLEMENTATION_PLAN.md)** - Backend development plan
- **[Database Integration](../DATABASE_INTEGRATION_COMPLETE.md)** - Database integration guide

### 🧪 **Testing**
Testing strategies and quality assurance:
- **[Testing Guide](testing/TESTING_GUIDE.md)** - Testing methodology
- **[Deployment Test Report](testing/DEPLOYMENT_TEST_REPORT.md)** - Deployment testing results

### 🔌 **Extensions**
Platform extensions and integrations:
- **[Extension Publisher](extensions/README_EXTENSION_PUBLISHER.md)** - Extension development
- **[Integration Guide](extensions/README_INTEGRATION.md)** - Platform integrations
- **[VS Code Publisher](extensions/README_VSCODE_PUBLISHER.md)** - VS Code extension

### 📱 **Desktop Application**
Desktop app documentation:
- **[Desktop App Guide](../DESKTOP_APP_GUIDE.md)** - Desktop application setup and usage

## 🏗️ **Project Structure**

```
queryflux/
├── docs/                          # Documentation hub
│   ├── deployment/                # Deployment guides
│   ├── features/                   # Feature documentation
│   ├── strategy/                   # Business strategy
│   ├── technical/                  # Technical architecture
│   ├── testing/                    # Testing documentation
│   ├── extensions/                 # Platform extensions
│   └── README.md                   # This file
├── src/                            # Source code
│   ├── components/                 # React components
│   ├── contexts/                   # React contexts
│   ├── design-system/              # Design tokens
│   ├── styles/                     # CSS and styling
│   └── utils/                      # Utility functions
├── backend/                        # Backend Go application
├── frontend/                       # Frontend web application
├── website/                        # Marketing website
└── .luna/                          # AI agent configurations
```

## 🎨 **Design System**

QueryFlux uses a comprehensive design system based on Apple's Human Interface Guidelines:

- **Typography**: SF Pro font family with proper hierarchy
- **Colors**: Semantic color system with dark mode support
- **Components**: Apple-style UI components (Button, Input, Card, etc.)
- **Animations**: Smooth transitions with Apple-style easing
- **Glass Morphism**: Modern blur effects and transparency

## 🚀 **Getting Started**

1. **Clone the repository**:
   ```bash
   git clone https://github.com/shacharsol/queryflux.git
   cd queryflux
   ```

2. **Set up development environment**:
   ```bash
   # Follow the Environment Setup guide
   cat ENVIRONMENT_SETUP.md
   ```

3. **Install dependencies**:
   ```bash
   # Frontend
   cd frontend && npm install
   
   # Backend (if needed)
   cd backend && go mod tidy
   ```

4. **Run the development server**:
   ```bash
   cd frontend && npm run dev
   ```

## 🤝 **Contributing**

Please read the [CLAUDE.md](../CLAUDE.md) file for detailed contribution guidelines.

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🔗 **Links**

- **Live Demo**: https://queryflux.ai
- **GitHub Repository**: https://github.com/shacharsol/queryflux
- **Documentation**: https://docs.queryflux.ai
- **Support**: support@queryflux.ai

---

**Last Updated**: 2024-10-20
**Version**: 1.0.0

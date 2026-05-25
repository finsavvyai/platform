# LunaForge v2.4.0 - Quick Start Guide

## 🎉 What's New

### Core Features (Free)
- **Galaxy**: Real-time 3D dependency visualization
- **Guardian**: Architecture rules with VS Code config integration
- **TimeTravel**: Full Git history integration
- **CodeFlow**: Code path analysis

### Premium Features (Early Access)
- **Dream**: AI code generation
- **Mythic**: Story-to-architecture AI
- **Autopsy**: Deep debugging analysis
- **Prophecy**: Predictive insights
- **Parallel Universe**: Code translation

## 🚀 Quick Deploy

### 1. Test Locally
```bash
# Build everything
npm run build

# Test extension (press F5 in VS Code)
# Open Extension Development Host
```

### 2. Deploy Worker (Optional - for Premium features)
```bash
cd workers/agent-brain

# Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY

# Deploy
npm run deploy
```

### 3. Publish Extension
```bash
cd packages/lunaforge-extension
vsce package
vsce publish
```

## ⚙️ Enable Premium Features

1. Open VS Code Settings
2. Search "LunaForge"
3. Enable "Enable Early Access"
4. Set "API Base URL" to your worker URL

## 📝 Testing Checklist

- [ ] Core modes work (Galaxy, Guardian, TimeTravel)
- [ ] Git integration shows commit history
- [ ] Premium modes activate with early access enabled
- [ ] Worker responds to health check
- [ ] License validation works

## 📚 Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [CHANGELOG.md](packages/lunaforge-extension/CHANGELOG.md) - Release notes
- [README.md](README.md) - Project overview

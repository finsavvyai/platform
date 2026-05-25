# Contributing to UPM.Plus

Thank you for your interest in contributing to UPM.Plus! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- Git

### Development Setup

1. **Fork and clone the repository**
```bash
git clone https://github.com/your-username/upm-plus.git
cd upm-plus
```

2. **Set up the development environment**
```bash
# Copy environment configuration
cp .env.example .env

# Start development services
docker-compose up -d

# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install
```

3. **Run the application**
```bash
# Backend (Terminal 1)
cd backend
uvicorn app.main:app --reload

# Frontend (Terminal 2)
cd frontend
npm start
```

## 📋 Development Guidelines

### Code Style

**Python (Backend)**
- Follow PEP 8 style guidelines
- Use Black for code formatting: `black app/`
- Use isort for import sorting: `isort app/`
- Use type hints for all functions and methods
- Maximum line length: 127 characters

**TypeScript/React (Frontend)**
- Use ESLint and Prettier for code formatting
- Follow React best practices and hooks patterns
- Use TypeScript for type safety
- Use Material-UI components consistently

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(agents): add multi-agent collaboration system
fix(auth): resolve JWT token expiration issue
docs(api): update workflow endpoint documentation
```

## 🏗️ Architecture Overview

### Backend Structure
```
backend/
├── app/
│   ├── agents/          # AI agent implementations
│   ├── api/             # API endpoints
│   ├── core/            # Core configuration
│   ├── models/          # Database models
│   ├── services/        # Business logic
│   └── main.py          # FastAPI application
├── tests/               # Test files
└── requirements.txt     # Dependencies
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/      # Reusable components
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── store/           # Redux store
│   └── utils/           # Utility functions
├── public/              # Static assets
└── package.json         # Dependencies
```

## 📞 Getting Help

- 💬 **Discord**: [Join our community](https://discord.gg/upmplus)
- 📧 **Email**: dev@upmplus.ai
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-org/upm-plus/issues)
- 📖 **Docs**: [Documentation](https://docs.upmplus.ai)

## 📄 License

By contributing to UPM.Plus, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to UPM.Plus! 🚀
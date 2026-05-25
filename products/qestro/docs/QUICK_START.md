# 🚀 TestFlow Pro SaaS - Quick Start Guide

Get your TestFlow Pro SaaS platform up and running in minutes!

## ⚡ Option 1: Automated Setup (Recommended)

### 1. Set up Supabase Database
```bash
./scripts/setup-supabase.sh
```
This script will:
- Guide you through creating a Supabase project
- Generate environment files with your credentials
- Install dependencies
- Set up the database schema
- Test the connection

### 2. Start Development
```bash
npm run dev
```
Open http://localhost:3000 and start recording tests!

## 🛠️ Option 2: Manual Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Name: `testflow-pro`
3. Save your database password!

### 2. Configure Environment
```bash
# Copy environment templates
cp .env.example .env
cp frontend/.env.example frontend/.env

# Edit .env with your Supabase credentials
```

### 3. Install & Setup
```bash
# Install dependencies
npm run setup:deps

# Setup database
cd backend
npm run db:generate
npm run db:migrate
cd ..

# Start development
npm run dev
```

## 🌐 Production Deployment

### Quick Deploy
```bash
./scripts/deploy.sh
```

### Manual Deploy
1. **Backend**: Deploy to Heroku/Railway/Render
2. **Frontend**: Deploy to Netlify
3. **Database**: Already on Supabase

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🎯 What You Get

- ✅ **Recording Studio**: Record mobile & web tests
- ✅ **Real-time Preview**: See actions as they happen
- ✅ **Export Options**: Maestro YAML, workflow-use YAML, JSON
- ✅ **Project Management**: Organize tests by project
- ✅ **User Authentication**: Secure multi-tenant SaaS
- ✅ **Cloud Database**: Supabase PostgreSQL
- ✅ **Modern UI**: React + TypeScript + Tailwind

## 🔧 Available Commands

```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Frontend only (port 3000)
npm run dev:backend      # Backend only (port 8000)

# Building
npm run build           # Build both for production
npm run build:frontend  # Build frontend only
npm run build:backend   # Build backend only

# Database
npm run db:generate     # Generate migrations
npm run db:migrate      # Run migrations
npm run db:studio       # Open database studio

# Testing
npm run test           # Run all tests
npm run test:frontend  # Frontend tests only
npm run test:backend   # Backend tests only

# Deployment
./scripts/deploy.sh         # Interactive deployment
./scripts/setup-supabase.sh # Supabase setup wizard
```

## 🏗️ Project Structure

```
testflow-pro-saas/
├── frontend/          # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/     # Recording Studio, Dashboard
│   │   ├── components/
│   │   └── config/
│   └── dist/          # Built frontend
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/  # Recording Service
│   │   ├── schema/    # Database schema
│   │   └── routes/
│   └── dist/          # Built backend
├── scripts/           # Deployment scripts
└── docs/             # Documentation
```

## 🎬 Recording Features

### Mobile Testing (Maestro)
- iOS and Android support
- Real-time action capture
- Export to Maestro YAML
- Device selection

### Web Testing (workflow-use)
- Chrome, Firefox, Safari support
- Browser automation
- Export to workflow-use YAML
- Viewport configuration

## 🔐 Authentication & Security

- JWT-based authentication
- Role-based access control
- Subscription tiers (Free, Pro, Enterprise)
- API rate limiting
- HTTPS enforcement

## 📊 Database Schema

- **Users**: Authentication and profiles
- **Projects**: Test organization
- **Recording Sessions**: Capture metadata
- **Recorded Actions**: Step-by-step actions
- **Test Suites**: Test collections
- **Test Cases**: Individual tests
- **Integrations**: Third-party connections

## 🤝 Support

- 📖 [Full Documentation](./DEPLOYMENT.md)
- 🐛 [Report Issues](https://github.com/testflow-pro/testflow-pro-saas/issues)
- 💬 [Discussions](https://github.com/testflow-pro/testflow-pro-saas/discussions)

## 🎉 Ready to Go!

Your TestFlow Pro SaaS platform is now ready to help teams create, manage, and execute automated tests across mobile and web platforms!

**Happy Testing!** 🚀
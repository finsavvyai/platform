# Quick Start Guide

Get up and running with Questro in minutes.

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- Docker (optional)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/questro.git
   cd questro
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   cd ../agent && npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development servers**
   ```bash
   # Start all services
   npm run dev
   
   # Or start individually
   npm run dev:backend
   npm run dev:frontend
   npm run dev:agent
   ```

## First Steps

1. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Agent Service: http://localhost:3002

2. **Create your first test**
   - Navigate to the dashboard
   - Click "Create New Test"
   - Follow the recording wizard

3. **Run your test**
   - Select your test from the dashboard
   - Click "Run Test"
   - View results in real-time

## Next Steps

- [Environment Setup Guide](./environment-setup.md)
- [Development Guide](../development/development-guide.md)
- [Testing Strategy](../testing/testing-strategy.md)

## Need Help?

- Check the [Troubleshooting Guide](../support/troubleshooting.md)
- Review [Known Issues](../support/known-issues.md)
- Visit our [FAQ](../support/faq.md)
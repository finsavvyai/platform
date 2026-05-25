# Installation Guide

Complete installation guide for Questro development and production environments.

## System Requirements

### Development Environment
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **PostgreSQL**: 14.0 or higher
- **Redis**: 6.0 or higher
- **Docker**: 20.10.0 or higher (optional)
- **Git**: 2.30.0 or higher

### Production Environment
- **CPU**: 4+ cores recommended
- **RAM**: 8GB+ recommended
- **Storage**: 50GB+ available space
- **Network**: Stable internet connection
- **SSL Certificate**: For HTTPS deployment

## Installation Methods

### Method 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/questro.git
cd questro

# Run automated setup
./quick-setup.sh
```

### Method 2: Manual Installation

#### 1. Clone Repository
```bash
git clone https://github.com/your-org/questro.git
cd questro
```

#### 2. Install Dependencies
```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..

# Backend dependencies
cd backend
npm install
cd ..

# Agent dependencies
cd agent
npm install
cd ..
```

#### 3. Database Setup
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database
createdb questro_development

# Run migrations
cd backend
npm run migrate
cd ..
```

#### 4. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

#### 5. Start Services
```bash
# Start all services
npm run dev

# Or start individually
npm run dev:backend    # Backend API
npm run dev:frontend   # React frontend
npm run dev:agent      # Agent service
```

### Method 3: Docker Installation

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

#### Setup
```bash
# Clone repository
git clone https://github.com/your-org/questro.git
cd questro

# Start with Docker Compose
docker-compose up -d

# Check status
docker-compose ps
```

## Platform-Specific Instructions

### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node postgresql redis git

# Start services
brew services start postgresql
brew services start redis
```

### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Git
sudo apt install git
```

### Windows
```powershell
# Install using Chocolatey
choco install nodejs postgresql redis-64 git

# Or use Windows Subsystem for Linux (WSL)
wsl --install
# Then follow Ubuntu instructions
```

## Verification

### Check Installation
```bash
# Verify Node.js
node --version  # Should be 18.0.0+

# Verify npm
npm --version   # Should be 8.0.0+

# Verify PostgreSQL
psql --version  # Should be 14.0+

# Verify Redis
redis-cli --version  # Should be 6.0+
```

### Test Services
```bash
# Test database connection
npm run test:db

# Test Redis connection
npm run test:redis

# Run health checks
npm run health-check
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# Kill processes if needed
kill -9 <PID>
```

#### Permission Issues
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm

# Fix PostgreSQL permissions
sudo -u postgres createuser --superuser $USER
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connection
psql -h localhost -U postgres -d questro_development
```

## Next Steps

After successful installation:

1. **Configure Environment**: Edit `.env` file with your settings
2. **Run Tests**: Execute `npm test` to verify setup
3. **Start Development**: Run `npm run dev` to start all services
4. **Access Application**: Visit http://localhost:3000

## Additional Resources

- [Environment Setup Guide](./environment-setup.md)
- [Development Guide](../development/development-guide.md)
- [Troubleshooting Guide](../support/troubleshooting.md)

## Support

If you encounter issues during installation:

1. Check the [Troubleshooting Guide](../support/troubleshooting.md)
2. Review [Known Issues](../support/known-issues.md)
3. Search existing [GitHub Issues](https://github.com/your-org/questro/issues)
4. Create a new issue with detailed information
# Scripts Directory

This directory contains all shell scripts organized by category for the Questro project.

## Directory Structure

```
scripts/
├── deployment/          # Production deployment scripts
├── development/         # Development and local scripts
├── testing/            # Testing and validation scripts
├── setup/              # Initial setup and configuration scripts
├── utilities/          # General utility scripts
└── desktop/            # Desktop application scripts
```

## Script Categories

### 🚀 Deployment Scripts (`deployment/`)
Scripts for deploying Questro to production environments.

- `backend-start-production.sh` - Start backend in production mode
- `check-deployment.sh` - Verify deployment status
- `check-domains.sh` - Check domain configuration
- `check-status.sh` - Check overall system status
- `check-unique-domains.sh` - Validate unique domain setup
- `deploy-now.sh` - Quick deployment script
- `deploy-production.sh` - Full production deployment
- `deploy-questro-io.sh` - Deploy to questro.io domain
- `deploy.sh` - General deployment script
- `quick-deploy.sh` - Streamlined deployment process

### 🔧 Development Scripts (`development/`)
Scripts for local development and testing.

- `build-and-run.sh` - Build and run the application
- `demo.sh` - Run demo scenarios
- `frontend-build.sh` - Build frontend application
- `launch-questro.sh` - Launch Questro platform
- `quick-start.sh` - Quick development setup
- `start-dev.sh` - Start development servers
- `start.sh` - Start all services
- `stop.sh` - Stop all services

### 🧪 Testing Scripts (`testing/`)
Scripts for running tests and validations.

- `backend-test-supabase-connection.sh` - Test backend database connection
- `run-browser-tests.sh` - Run browser automation tests
- `run-tests.sh` - Run all test suites
- `simple-test.sh` - Basic functionality tests
- `start-browser-test.sh` - Start browser testing environment
- `test-local.sh` - Local testing suite

### ⚙️ Setup Scripts (`setup/`)
Scripts for initial setup and configuration.

- `backend-setup-supabase.sh` - Backend Supabase configuration
- `quick-setup.sh` - Quick project setup
- `setup-accounts.sh` - Set up external service accounts
- `setup-lemonsqueezy.sh` - Configure LemonSqueezy payment processing
- `setup-render.sh` - Configure Render deployment
- `setup-supabase.sh` - Set up Supabase database and auth

### 🛠️ Utility Scripts (`utilities/`)
General utility and maintenance scripts.

- `cleanup-docs.sh` - Clean up documentation files
- `fix-imports.sh` - Fix import statements in code
- `marketing-launch.sh` - Marketing and launch utilities
- `status.sh` - Check system status
- `validate-env.sh` - Validate environment configuration
- `validate-production.sh` - Validate production setup

### 🖥️ Desktop Scripts (`desktop/`)
Scripts specific to the desktop application.

- `auto-demo.sh` - Automated desktop demo
- `demo-voice-integration.sh` - Voice integration demo
- `install.sh` - Install desktop application
- `show-desktop.sh` - Display desktop application

## Usage Guidelines

### Making Scripts Executable
Before running any script, make sure it's executable:
```bash
chmod +x scripts/category/script-name.sh
```

### Running Scripts
Run scripts from the project root directory:
```bash
# Development
./scripts/development/start.sh

# Deployment
./scripts/deployment/deploy-production.sh

# Testing
./scripts/testing/run-tests.sh

# Setup
./scripts/setup/quick-setup.sh
```

### Environment Variables
Many scripts require environment variables to be set. Make sure to:
1. Copy `.env.example` to `.env`
2. Configure all required variables
3. Source the environment if needed: `source .env`

## Script Development Guidelines

### Naming Conventions
- Use kebab-case for script names
- Include category prefix when needed (e.g., `backend-`, `frontend-`)
- Use descriptive names that indicate the script's purpose

### Script Structure
```bash
#!/bin/bash

# Script description and usage
# Usage: ./script-name.sh [options]

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Functions
function main() {
    echo "Starting script..."
    # Script logic here
}

# Error handling
function cleanup() {
    echo "Cleaning up..."
}
trap cleanup EXIT

# Main execution
main "$@"
```

### Best Practices
1. **Error Handling**: Use `set -e` and proper error checking
2. **Documentation**: Include usage instructions and examples
3. **Logging**: Provide clear output and progress indicators
4. **Validation**: Validate inputs and prerequisites
5. **Cleanup**: Clean up temporary files and processes
6. **Portability**: Write portable shell scripts (avoid bash-specific features when possible)

## Common Script Patterns

### Environment Validation
```bash
function validate_env() {
    local required_vars=("DATABASE_URL" "JWT_SECRET" "OPENAI_API_KEY")
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            echo "Error: $var is not set"
            exit 1
        fi
    done
}
```

### Service Health Check
```bash
function check_service() {
    local service_name="$1"
    local port="$2"
    
    if nc -z localhost "$port"; then
        echo "✅ $service_name is running on port $port"
        return 0
    else
        echo "❌ $service_name is not running on port $port"
        return 1
    fi
}
```

### Progress Indication
```bash
function show_progress() {
    local current="$1"
    local total="$2"
    local message="$3"
    
    local percent=$((current * 100 / total))
    echo "[$current/$total] ($percent%) $message"
}
```

## Troubleshooting

### Common Issues

#### Permission Denied
```bash
chmod +x scripts/category/script-name.sh
```

#### Script Not Found
Make sure you're running from the project root:
```bash
cd /path/to/questro
./scripts/category/script-name.sh
```

#### Environment Variables Not Set
```bash
# Check if variables are set
printenv | grep QUESTRO

# Source environment file
source .env
```

#### Port Already in Use
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 $(lsof -t -i:3000)
```

### Getting Help
- Check script documentation: `./scripts/category/script-name.sh --help`
- Review script source code for usage examples
- Check the [Troubleshooting Guide](../docs/support/troubleshooting-guide.md)

## Contributing

When adding new scripts:
1. Place them in the appropriate category directory
2. Follow the naming conventions
3. Include proper documentation and error handling
4. Test thoroughly before committing
5. Update this README if adding new categories

---

For more information about specific scripts, check the individual script files or refer to the [Development Documentation](../docs/development/).
#!/bin/bash
# QueryLens Setup Script for macOS
# This script sets up the QueryLens environment on macOS

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}          QueryLens Setup Script for macOS           ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to print status
print_status() {
    echo -e "\n${YELLOW}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check system requirements
print_status "Checking system requirements..."

# Check for Homebrew
if ! command_exists brew; then
    print_error "Homebrew not found. Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    print_success "Homebrew installed successfully"
else
    print_success "Homebrew found"
fi

# Check for Java 17+
if ! command_exists java; then
    print_error "Java not found. Installing OpenJDK 21..."
    brew install openjdk@21
    echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
    export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
    print_success "Java 21 installed successfully"
else
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -ge 17 ]; then
        print_success "Java $JAVA_VERSION found (compatible)"
    else
        print_error "Java version $JAVA_VERSION found, but Java 17+ required. Installing OpenJDK 21..."
        brew install openjdk@21
        echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
        export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
        print_success "Java 21 installed successfully"
    fi
fi

# Check for Maven
if ! command_exists mvn; then
    print_error "Maven not found. Installing Maven..."
    brew install maven
    print_success "Maven installed successfully"
else
    print_success "Maven found"
fi

# Check for curl (should be available on macOS)
if ! command_exists curl; then
    print_error "curl not found. Installing curl..."
    brew install curl
    print_success "curl installed successfully"
else
    print_success "curl found"
fi

# Check for jq for JSON parsing
if ! command_exists jq; then
    print_error "jq not found. Installing jq..."
    brew install jq
    print_success "jq installed successfully"
else
    print_success "jq found"
fi

# Optional: Check for PostgreSQL
print_status "Checking optional dependencies..."
if ! command_exists psql; then
    echo -e "${YELLOW}PostgreSQL not found. You can install it later if needed with: brew install postgresql${NC}"
else
    print_success "PostgreSQL found"
fi

# Build the application
print_status "Building QueryLens application..."
if mvn clean install -q; then
    print_success "QueryLens built successfully"
else
    print_error "Failed to build QueryLens"
    exit 1
fi

# Create startup script
print_status "Creating startup scripts..."

cat > start-querylens.sh << 'EOF'
#!/bin/bash
# QueryLens Startup Script

echo "Starting QueryLens..."
echo "Available profiles: h2 (default), postgresql, duckdb"
echo "Usage: ./start-querylens.sh [profile]"
echo ""

PROFILE=${1:-h2}
echo "Using profile: $PROFILE"

# Check if already running
if lsof -i :8080 >/dev/null 2>&1; then
    echo "QueryLens is already running on port 8080"
    echo "Stop it first with: ./stop-querylens.sh"
    exit 1
fi

# Start the application
nohup mvn spring-boot:run -Dspring.profiles.active=$PROFILE > querylens.log 2>&1 &
echo $! > querylens.pid

echo "QueryLens is starting..."
echo "Waiting for application to be ready..."

# Wait for application to start
for i in {1..30}; do
    if curl -s http://localhost:8080/ >/dev/null 2>&1; then
        echo "✓ QueryLens is ready!"
        echo "Web interface: http://localhost:8080"
        echo "API base URL: http://localhost:8080/api"
        echo "H2 Console (if using H2): http://localhost:8080/h2-console"
        echo ""
        echo "To stop: ./stop-querylens.sh"
        echo "To view logs: tail -f querylens.log"
        exit 0
    fi
    sleep 2
    echo -n "."
done

echo ""
echo "✗ QueryLens failed to start within 60 seconds"
echo "Check querylens.log for details"
exit 1
EOF

cat > stop-querylens.sh << 'EOF'
#!/bin/bash
# QueryLens Stop Script

echo "Stopping QueryLens..."

if [ -f querylens.pid ]; then
    PID=$(cat querylens.pid)
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        echo "QueryLens stopped (PID: $PID)"
        rm querylens.pid
    else
        echo "QueryLens process not found"
        rm querylens.pid
    fi
else
    # Try to find and kill by port
    PID=$(lsof -ti :8080)
    if [ ! -z "$PID" ]; then
        kill $PID
        echo "QueryLens stopped (PID: $PID)"
    else
        echo "QueryLens is not running"
    fi
fi
EOF

chmod +x start-querylens.sh
chmod +x stop-querylens.sh
print_success "Startup scripts created"

# Create test script shortcut
cp final-test.sh test-querylens.sh
print_success "Test script created (test-querylens.sh)"

# Setup PostgreSQL (optional)
read -p "$(echo -e ${YELLOW}Do you want to set up PostgreSQL? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Setting up PostgreSQL..."
    
    if ! command_exists psql; then
        brew install postgresql
        brew services start postgresql
    fi
    
    # Create database and user
    createdb querylens 2>/dev/null || echo "Database 'querylens' already exists"
    psql -d postgres -c "CREATE USER querylens WITH PASSWORD 'querylens';" 2>/dev/null || echo "User 'querylens' already exists"
    psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE querylens TO querylens;" 2>/dev/null
    
    print_success "PostgreSQL setup completed"
    echo -e "${YELLOW}To use PostgreSQL: ./start-querylens.sh postgresql${NC}"
fi

print_status "Creating configuration file..."
cat > querylens-config.sh << 'EOF'
#!/bin/bash
# QueryLens Configuration

# Default settings
export QUERYLENS_PORT=8080
export QUERYLENS_PROFILE=h2

# H2 Database settings
export H2_URL="jdbc:h2:mem:querylens"
export H2_USERNAME="sa"
export H2_PASSWORD=""

# PostgreSQL settings (uncomment and modify as needed)
# export POSTGRES_URL="jdbc:postgresql://localhost:5432/querylens"
# export POSTGRES_USERNAME="querylens"
# export POSTGRES_PASSWORD="querylens"

# NLP Service settings
export NLP_SERVICE_URL="http://localhost:5000"

echo "QueryLens configuration loaded"
EOF

chmod +x querylens-config.sh
print_success "Configuration file created"

# Final setup completion
echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}            QueryLens Setup Complete!                ${NC}"
echo -e "${GREEN}======================================================${NC}"

echo -e "\n${YELLOW}Quick Start:${NC}"
echo -e "1. Start QueryLens:       ${BLUE}./start-querylens.sh${NC}"
echo -e "2. Open web interface:    ${BLUE}http://localhost:8080${NC}"
echo -e "3. Run tests:            ${BLUE}./test-querylens.sh${NC}"
echo -e "4. Stop QueryLens:       ${BLUE}./stop-querylens.sh${NC}"

echo -e "\n${YELLOW}Database Profiles:${NC}"
echo -e "• H2 (default):          ${BLUE}./start-querylens.sh h2${NC}"
echo -e "• PostgreSQL:            ${BLUE}./start-querylens.sh postgresql${NC}"
echo -e "• DuckDB:                ${BLUE}./start-querylens.sh duckdb${NC}"

echo -e "\n${YELLOW}Useful Commands:${NC}"
echo -e "• View logs:             ${BLUE}tail -f querylens.log${NC}"
echo -e "• H2 Console:            ${BLUE}http://localhost:8080/h2-console${NC}"
echo -e "• API Documentation:     ${BLUE}http://localhost:8080/api${NC}"

echo -e "\n${YELLOW}Configuration:${NC}"
echo -e "• Edit settings:         ${BLUE}./querylens-config.sh${NC}"
echo -e "• Application config:    ${BLUE}src/main/resources/application.yml${NC}"

echo -e "\n${GREEN}Setup completed successfully! 🎉${NC}"
echo -e "Run ${BLUE}./start-querylens.sh${NC} to begin!"
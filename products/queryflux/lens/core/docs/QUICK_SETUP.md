# QueryLens Quick Setup Guide

## Prerequisites
- Java 21 or higher
- Maven 3.8+
- Git

## Quick Start (3 minutes)

### 1. Clone and Enter Directory
```bash
git clone [repository-url]
cd querylens/querylens-core
```

### 2. Run Setup Script

**macOS/Linux:**
```bash
chmod +x setup-mac.sh
./setup-mac.sh
```

**Windows:**
```cmd
setup-windows.bat
```

### 3. Start QueryLens
```bash
./start-querylens.sh    # macOS/Linux
# OR
start-querylens.bat     # Windows
```

### 4. Access the Application
Open browser: http://localhost:8080

## Manual Setup (if scripts fail)

### 1. Build the Project
```bash
mvn clean install
```

### 2. Run the Application
```bash
mvn spring-boot:run
```

## Test the Installation

### Quick Test Command
```bash
curl -X POST "http://localhost:8080/api/query/execute" \
  -H "Content-Type: application/json" \
  -d '{"text": "Find all active cards", "datasourceId": 1}' | jq .
```

### Run Full Test Suite
```bash
./final-test.sh
```

## Features Available Immediately

1. **Natural Language Queries**
   - "Find all active cards"
   - "Show top 10 products by value"
   - "Count all users"

2. **Dashboard** 
   - Manage common prompts
   - Save favorite queries
   - Track usage statistics

3. **API Endpoints**
   - `/api/query/execute` - Natural language queries
   - `/api/query/execute-sql` - Direct SQL
   - `/api/prompts` - Manage saved prompts
   - `/api/datasources` - Manage data connections

## Default Credentials
- H2 Console: http://localhost:8080/h2-console
- JDBC URL: `jdbc:h2:mem:querylens`
- Username: `sa`
- Password: (leave blank)

## Troubleshooting

### Port 8080 Already in Use
```bash
# Kill existing process
lsof -ti:8080 | xargs kill -9  # macOS/Linux
# OR change port in application.properties
```

### Java Version Issues
```bash
# Check Java version
java -version
# Should show 21 or higher

# Install Java 21 (macOS)
brew install openjdk@21
```

### Maven Not Found
```bash
# Install Maven (macOS)
brew install maven

# Install Maven (Ubuntu/Debian)
sudo apt install maven
```

## Stop the Application
```bash
./stop-querylens.sh     # macOS/Linux
# OR
stop-querylens.bat      # Windows
# OR
Ctrl+C in terminal
```

## Next Steps
1. Create a real database connection via UI
2. Import your database schema
3. Start querying with natural language!

## Support
- Check logs: `querylens-*.log`
- View documentation: `/CLAUDE.md`
- API docs: http://localhost:8080 (API Documentation tab)
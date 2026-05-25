

# QueryLens Core Service

Natural Language to SQL Query Engine with Enhanced NLP Processing

## 🚀 Quick Start

### Option 1: One Command Setup
```bash
./scripts/setup/quick-start.sh
```

### Option 2: Platform-Specific Setup
```bash
# macOS/Linux
./scripts/setup/setup-mac.sh

# Windows
scripts\setup\setup-windows.bat
```

### Option 3: Manual Setup
```bash
cd build && mvn clean install && cd ..
mvn spring-boot:run
```

## 📁 Project Structure

```
querylens-core/
├── src/                    # Source code
├── scripts/               # All scripts organized by purpose
│   ├── setup/            # Setup and installation scripts
│   ├── tests/            # Testing scripts
│   └── utils/            # Utility scripts
├── docs/                 # Documentation
├── logs/                 # Application logs
├── sql/                  # SQL files and data
├── deployment/           # Docker & deployment files
├── build/                # Build configuration (pom.xml)
├── config/               # Configuration files
├── db/                   # Database files
└── target/               # Build artifacts
```

## 🧪 Testing

### Run All Tests
```bash
./scripts/tests/final-test.sh
```

### Specific Tests
```bash
./scripts/tests/test-api.sh              # API endpoints
./scripts/tests/test-nlp-queries.sh      # NLP functionality
./scripts/tests/test-enhanced-nlp.sh     # Enhanced NLP features
./scripts/tests/advanced-test.sh         # Advanced capabilities
```

## 🔧 Utilities

### Database Management
```bash
./scripts/utils/create-sample-data.sh    # Create sample data
./scripts/utils/initialize-sample-data.sh # Initialize database
./scripts/utils/restart-querylens.sh     # Restart application
```

### Development Tools
```bash
./scripts/utils/debug-sql.sh             # Debug SQL queries
./scripts/utils/run-simple.sh            # Simple run mode
```

## 📚 Documentation

- [`docs/CLAUDE.md`](docs/CLAUDE.md) - Comprehensive project documentation
- [`docs/QUICK_SETUP.md`](docs/QUICK_SETUP.md) - Detailed setup guide
- [`docs/SETUP_NEW_MACHINE.md`](docs/SETUP_NEW_MACHINE.md) - New machine setup

## 🌐 Access Points

- **Web UI**: http://localhost:8080
- **H2 Console**: http://localhost:8080/h2-console
- **API Base**: http://localhost:8080/api

## 📋 Key Features

✅ **Natural Language Processing** - Convert English to SQL
✅ **Smart Entity Detection** - Recognizes tables, columns, conditions
✅ **Multi-Database Support** - H2, PostgreSQL, DuckDB
✅ **Dashboard Interface** - Manage common queries
✅ **REST API** - Full programmatic access
✅ **Mock Mode** - Works without real data

## 🔗 API Endpoints

### Query Execution
- `POST /api/query/execute` - Natural language queries
- `POST /api/query/execute-sql` - Direct SQL execution

### Prompt Management
- `GET /api/prompts` - List all prompts
- `POST /api/prompts` - Create new prompt
- `PUT /api/prompts/{id}` - Update prompt

### Data Sources
- `GET /api/datasources` - List data sources
- `POST /api/datasources` - Add new data source

## 🛠 Development

### Prerequisites
- Java 21+
- Maven 3.8+

### Build
```bash
cd build && mvn clean compile && cd ..
```

### Run Tests
```bash
cd build && mvn test && cd ..
```

### Package
```bash
cd build && mvn clean package && cd ..
```

## 📊 Example Queries

Try these natural language queries:

- "Find all active cards"
- "Show top 10 customers by revenue"
- "Count products by category"
- "List orders from last month"
- "Find users with email containing gmail"

## 🐛 Troubleshooting

### Check Logs
```bash
tail -f logs/querylens*.log
```

### Port Issues
```bash
lsof -ti:8080 | xargs kill -9  # Kill process on port 8080
```

### Database Issues
```bash
./scripts/utils/debug-sql.sh  # Debug SQL connections
```

## 📁 Directory Details

### `/scripts/setup/`
- `quick-start.sh` - One-command setup with checks
- `setup-mac.sh` - macOS/Linux setup with dependencies
- `setup-windows.bat` - Windows setup script

### `/scripts/tests/`
- `final-test.sh` - Comprehensive test suite (16 tests)
- `test-enhanced-nlp.sh` - Enhanced NLP features test
- `test-api.sh` - API endpoint testing
- `advanced-test.sh` - Advanced capability testing

### `/scripts/utils/`
- `restart-querylens.sh` - Restart application safely
- `create-sample-data.sh` - Generate sample data
- `debug-sql.sh` - Debug SQL queries
- `run-simple.sh` - Simple run without logs

## 🚀 Getting Started Checklist

- [ ] Run `./scripts/setup/quick-start.sh`
- [ ] Access http://localhost:8080
- [ ] Run `./scripts/tests/final-test.sh`
- [ ] Try a natural language query
- [ ] Check the dashboard tab

---

**Ready to query with natural language!** 🎯
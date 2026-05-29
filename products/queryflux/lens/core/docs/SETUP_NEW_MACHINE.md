# QueryLens - New Machine Setup (2 Minutes)

## Option 1: One-Line Setup (Recommended)

### macOS/Linux
```bash
curl -sSL https://raw.githubusercontent.com/[your-repo]/querylens/main/setup-mac.sh | bash
```

### Windows (PowerShell as Admin)
```powershell
iwr -useb https://raw.githubusercontent.com/[your-repo]/querylens/main/setup-windows.ps1 | iex
```

## Option 2: Quick Manual Setup

### 1. Install Prerequisites (1 minute)

**macOS:**
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Java 21 and Maven
brew install openjdk@21 maven git
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install openjdk-21-jdk maven git curl jq -y
```

**Windows:**
- Download Java 21: https://adoptium.net/
- Download Maven: https://maven.apache.org/download.cgi
- Add to PATH

### 2. Clone and Run (1 minute)
```bash
# Clone the repository
git clone [repository-url] querylens
cd querylens/querylens-core

# Quick start
./quick-start.sh
```

## Instant Test Commands

### Test Natural Language Query
```bash
curl -X POST "http://localhost:8080/api/query/execute" \
  -H "Content-Type: application/json" \
  -d '{"text": "Find all active cards", "datasourceId": 1}'
```

### Expected Response
```json
{
  "data": [{
    "MESSAGE": "MOCK",
    "INTERPRETATION": "Query: Find all active cards",
    "EXPECTED_SQL": "CARDS table would be filtered by status = active",
    "NOTE": "No CARDS table found in schema"
  }],
  "success": true
}
```

## What's Included

✅ **Smart NLP Query Engine** - Understands natural language
✅ **Dashboard UI** - Save and manage common queries  
✅ **Multi-Database Support** - H2, PostgreSQL, DuckDB
✅ **REST API** - Full API for integration
✅ **Mock Mode** - Works even without real data

## Quick Verification Checklist

- [ ] Application starts on http://localhost:8080
- [ ] Dashboard shows 10 default prompts
- [ ] API test returns mock response
- [ ] H2 console accessible at /h2-console

## Troubleshooting

### Common Issues & Fixes

**"Port 8080 already in use"**
```bash
lsof -ti:8080 | xargs kill -9
```

**"Java 21 not found"**
```bash
java -version  # Check current version
# Follow install steps above for your OS
```

**"Maven command not found"**
```bash
which mvn  # Check if installed
# Follow install steps above for your OS
```

## Next Steps

1. **Run full test suite:**
   ```bash
   ./final-test.sh
   ```

2. **Connect real database:**
   - Go to http://localhost:8080
   - Click "Datasources" tab
   - Add your database

3. **Try example queries:**
   - "Show top 10 customers by revenue"
   - "Find all orders from last month"
   - "Count products by category"

## Support Files

- `CLAUDE.md` - Full documentation
- `final-test.sh` - Comprehensive test suite
- `logs/` - Application logs
- `QUICK_SETUP.md` - Detailed setup guide

---
Ready in 2 minutes! 🚀
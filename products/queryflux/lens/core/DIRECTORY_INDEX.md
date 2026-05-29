# QueryLens Directory Index

## 📁 Organized Project Structure

### 🚀 Quick Access Commands

```bash
# Start application
./scripts/setup/quick-start.sh

# Run all tests
./scripts/tests/final-test.sh

# View documentation
cat docs/CLAUDE.md
```

## 📂 Directory Structure

### `/scripts/` - All executable scripts

#### `/scripts/setup/` - Setup & Installation
| File | Purpose |
|------|---------|
| `quick-start.sh` | ⭐ One-command setup with prereq checks |
| `setup-mac.sh` | macOS/Linux setup with brew/apt installs |
| `setup-windows.bat` | Windows setup script |

#### `/scripts/tests/` - Testing Scripts
| File | Purpose |
|------|---------|
| `final-test.sh` | ⭐ Complete test suite (16 tests) |
| `test-enhanced-nlp.sh` | Enhanced NLP features testing |
| `test-api.sh` | REST API endpoint testing |
| `test-nlp-queries.sh` | Basic NLP query testing |
| `test-improved.sh` | Improved functionality tests |
| `test-connection.sh` | Database connection testing |
| `advanced-test.sh` | Advanced capability testing |

#### `/scripts/utils/` - Utility Scripts
| File | Purpose |
|------|---------|
| `restart-querylens.sh` | Safe application restart |
| `create-sample-data.sh` | Generate sample data |
| `initialize-sample-data.sh` | Initialize database with data |
| `debug-sql.sh` | Debug SQL queries and connections |
| `run-simple.sh` | Simple run without logs |
| `run-querylens-duckdb.sh` | Run with DuckDB backend |

### `/docs/` - Documentation
| File | Purpose |
|------|---------|
| `CLAUDE.md` | ⭐ Complete project documentation |
| `QUICK_SETUP.md` | Detailed setup instructions |
| `SETUP_NEW_MACHINE.md` | New machine setup guide |
| `README-docker.md` | Docker-specific documentation |

### `/logs/` - Application Logs
| File | Purpose |
|------|---------|
| `querylens-enhanced-final.log` | Latest enhanced version logs |
| `querylens-*.log` | Various application run logs |

### `/sql/` - Database Files
| File | Purpose |
|------|---------|
| `direct-sample-data.sql` | Direct SQL data insertion |

### `/deployment/` - Containerization & Deployment
| File | Purpose |
|------|---------|
| `Dockerfile` | Container build instructions |
| `docker-compose.yml` | Multi-service orchestration |

### `/build/` - Build Configuration
| File | Purpose |
|------|---------|
| `pom.xml` | Maven build configuration |

### `/config/` - Configuration Files
| File | Purpose |
|------|---------|
| *(Future configuration files)* | Application configuration |

### Root Level Files
| File | Purpose |
|------|---------|
| `README.md` | ⭐ Main project overview |
| `DIRECTORY_INDEX.md` | This file - directory navigation |

## 🎯 Common Workflows

### New Machine Setup
```bash
1. ./scripts/setup/quick-start.sh
2. Open http://localhost:8080
3. ./scripts/tests/final-test.sh
```

### Development Workflow
```bash
1. ./scripts/utils/restart-querylens.sh
2. Make changes
3. ./scripts/tests/test-api.sh
4. ./scripts/tests/test-enhanced-nlp.sh
```

### Debugging Issues
```bash
1. tail -f logs/querylens*.log
2. ./scripts/utils/debug-sql.sh
3. ./scripts/tests/test-connection.sh
```

## 📋 File Categories Summary

- **🚀 Setup Scripts**: 3 files in `/scripts/setup/`
- **🧪 Test Scripts**: 8 files in `/scripts/tests/`
- **🔧 Utility Scripts**: 6 files in `/scripts/utils/`
- **📚 Documentation**: 4 files in `/docs/`
- **📊 Log Files**: Multiple in `/logs/`
- **🗃️ SQL Files**: In `/sql/`
- **🚀 Deployment Files**: In `/deployment/`
- **🔧 Build Files**: In `/build/`
- **⚙️ Config Files**: In `/config/`

## 🔍 Find Files Quickly

```bash
# Find setup scripts
ls scripts/setup/

# Find test scripts
ls scripts/tests/

# Find documentation
ls docs/

# Find logs
ls logs/

# Find by name pattern
find . -name "*test*" -type f
find . -name "*setup*" -type f
```

---
**Organized for easy navigation and maintenance!** 📁
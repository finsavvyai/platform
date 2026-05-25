# 🎯 Qestro Professional CLI Documentation

## Overview

The Qestro Professional CLI is a standalone, enterprise-grade command-line interface for comprehensive testing automation. It provides formal commands with parameters, works from any directory, and requires no npm dependencies.

## Installation

### Quick Install
```bash
# Run the quick-start script
./quick-start.sh

# Or manual installation
cd QestroDesktop
swift build --configuration release
cp .build/release/qestro ~/.local/bin/qestro-pro
export PATH="$HOME/.local/bin:$PATH"
```

### Verify Installation
```bash
qestro-pro --help
```

## Command Structure

The CLI follows a professional command structure with subcommands and parameters:

```
qestro-pro [OPTIONS] <SUBCOMMAND> [ARGS]
```

### Global Options
- `--server <url>` - Backend server URL (default: http://localhost:3020)
- `--verbose` - Enable verbose logging
- `--help` - Show help information

## Commands Reference

### 1. Recording Commands

#### Web Recording
```bash
qestro-pro record web --url <URL> [--browser <BROWSER>]
```
- `--url` - Target URL to record
- `--browser` - Browser choice: chrome (default), firefox, safari

Example:
```bash
qestro-pro record web --url https://example.com --browser chrome
```

#### Mobile Recording
```bash
qestro-pro record mobile --platform <PLATFORM> [--device <DEVICE>]
```
- `--platform` - Platform: ios, android
- `--device` - Device name or ID

Example:
```bash
qestro-pro record mobile --platform ios --device "iPhone 15"
```

#### List Recordings
```bash
qestro-pro record list [--active]
```
- `--active` - Show only active recordings

### 2. Voice-to-Text Commands

#### List Providers
```bash
qestro-pro voice providers
```
Shows available voice recognition providers:
- OpenAI Whisper API
- Google Speech-to-Text
- AWS Transcribe
- Azure Speech Services
- Local/Offline Provider

#### Voice Commands
```bash
qestro-pro voice commands
```
Displays supported voice command patterns.

#### Voice Recording
```bash
qestro-pro voice record --platform <PLATFORM> --framework <FRAMEWORK>
```
- `--platform` - Target platform: web, mobile
- `--framework` - Test framework: playwright, cypress, selenium, maestro

Example:
```bash
qestro-pro voice record --platform web --framework playwright
```

#### Voice Transcription
```bash
qestro-pro voice transcribe <AUDIO_FILE> [--language <LANG>]
```
- `<AUDIO_FILE>` - Path to audio file
- `--language` - Language code (default: en-US)

### 3. API Testing Commands

#### Test Endpoint
```bash
qestro-pro api test <ENDPOINT> [--method <METHOD>] [--body <BODY>]
```
- `<ENDPOINT>` - API endpoint URL
- `--method` - HTTP method: GET (default), POST, PUT, DELETE
- `--body` - Request body (JSON string)

Examples:
```bash
# GET request
qestro-pro api test https://api.github.com/users/octocat

# POST request with body
qestro-pro api test https://api.example.com/users \
  --method POST \
  --body '{"name":"John","email":"john@example.com"}'
```

#### API Validation
```bash
qestro-pro api validate <ENDPOINT> [--schema <SCHEMA_FILE>]
```
- `--schema` - JSON schema file for validation

#### API Collection
```bash
qestro-pro api collection <COLLECTION_FILE>
```
Run tests from Postman/Insomnia collection.

### 4. AI-Powered Testing

#### Generate Tests
```bash
qestro-pro ai generate --type <TYPE> --target <TARGET> [--framework <FRAMEWORK>]
```
- `--type` - Test type: web, mobile, api
- `--target` - Target URL, app ID, or API endpoint
- `--framework` - Output framework (optional)

Examples:
```bash
# Generate web tests
qestro-pro ai generate --type web --target https://example.com

# Generate mobile tests
qestro-pro ai generate --type mobile --target com.example.app
```

#### Analyze Tests
```bash
qestro-pro ai analyze <TEST_FILE>
```
Analyze existing test file for improvements.

#### Optimize Test Suite
```bash
qestro-pro ai optimize <TEST_DIRECTORY>
```
Optimize entire test suite for performance.

### 5. Data Validation

#### Connect to Database
```bash
qestro-pro data connect --type <TYPE> --connection <CONNECTION_STRING>
```
- `--type` - Database type: postgresql, mysql, mongodb
- `--connection` - Connection string

Example:
```bash
qestro-pro data connect \
  --type postgresql \
  --connection "host=localhost port=5432 dbname=testdb"
```

#### Validate Data
```bash
qestro-pro data validate <CONFIG_FILE>
```
Validate data against configuration rules.

#### Data Quality Check
```bash
qestro-pro data quality --connection-id <ID> --table <TABLE>
```
Run data quality checks on specific table.

### 6. System Commands

#### Health Check
```bash
qestro-pro health
```
Check backend service health status.

#### Platform Status
```bash
qestro-pro status
```
Show current platform status and metrics.

#### Interactive Mode
```bash
qestro-pro interactive
```
Launch interactive mode (legacy interface).

## Voice Command Patterns

During voice-guided recording, use natural language commands:

### Navigation
- "navigate to [URL]"
- "go to [page name]"
- "open [URL]"

### Interaction
- "click [element]"
- "tap [button]"
- "select [option]"

### Input
- "type [text]"
- "enter [text] in [field]"
- "fill [field] with [value]"

### Assertion
- "verify [element] is visible"
- "check [text] appears"
- "assert [condition]"

### Wait
- "wait for [element]"
- "wait [n] seconds"
- "pause recording"

### Control
- "stop recording"
- "pause session"
- "resume recording"

## Environment Variables

Configure CLI behavior with environment variables:

```bash
export QESTRO_SERVER=http://localhost:3020
export QESTRO_VERBOSE=true
export QESTRO_TIMEOUT=30000
```

## Configuration File

Create `~/.qestrorc` for persistent configuration:

```json
{
  "server": "http://localhost:3020",
  "verbose": false,
  "defaultBrowser": "chrome",
  "defaultFramework": "playwright",
  "voiceProvider": "openai"
}
```

## Examples

### Complete Web Testing Workflow
```bash
# Start recording
qestro-pro record web --url https://example.com

# Generate AI tests
qestro-pro ai generate --type web --target https://example.com

# Run API tests
qestro-pro api test https://api.example.com/health

# Check recordings
qestro-pro record list
```

### Voice-Guided Mobile Testing
```bash
# Start voice recording
qestro-pro voice record --platform mobile --framework maestro

# Voice commands:
# "open the app"
# "tap login button"
# "type username testuser"
# "type password in password field"
# "tap submit"
# "verify welcome message appears"
# "stop recording"
```

### API Testing Suite
```bash
# Test single endpoint
qestro-pro api test https://api.example.com/users

# Run collection
qestro-pro api collection postman-collection.json

# Validate response schema
qestro-pro api validate https://api.example.com/users \
  --schema user-schema.json
```

## Troubleshooting

### Command Not Found
```bash
# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Or use full path
~/.local/bin/qestro-pro --help
```

### Backend Connection Issues
```bash
# Check backend health
qestro-pro health

# Specify custom server
qestro-pro --server http://localhost:3020 health
```

### Permission Denied
```bash
# Make executable
chmod +x ~/.local/bin/qestro-pro
```

## Integration

### CI/CD Pipeline
```yaml
# GitHub Actions example
steps:
  - name: Install Qestro CLI
    run: |
      curl -L https://qestro.io/install.sh | bash

  - name: Run Tests
    run: |
      qestro-pro record web --url ${{ secrets.APP_URL }}
      qestro-pro api test ${{ secrets.API_URL }}
```

### Docker Integration
```dockerfile
FROM swift:5.9
COPY qestro /usr/local/bin/qestro-pro
RUN chmod +x /usr/local/bin/qestro-pro
CMD ["qestro-pro", "health"]
```

### Shell Scripts
```bash
#!/bin/bash
# Automated testing script

# Start recording
qestro-pro record web --url $TARGET_URL

# Wait for recording
sleep 30

# Generate tests
qestro-pro ai generate --type web --target $TARGET_URL

# List results
qestro-pro record list
```

## Best Practices

1. **Use Verbose Mode for Debugging**
   ```bash
   qestro-pro --verbose <command>
   ```

2. **Set Default Configuration**
   Create `~/.qestrorc` with your defaults

3. **Use Environment Variables in CI/CD**
   ```bash
   export QESTRO_SERVER=$CI_SERVER_URL
   ```

4. **Batch API Tests**
   Use collection files for multiple endpoints

5. **Voice Commands**
   - Speak clearly and use command patterns
   - Pause between commands
   - Use "stop recording" to finish

## Support

- Documentation: https://qestro.io/docs
- GitHub: https://github.com/qestro/cli
- Email: support@qestro.io
- Discord: https://discord.gg/qestro

## License

MIT License - See LICENSE file for details.
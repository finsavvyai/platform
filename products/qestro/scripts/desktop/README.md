# Desktop Scripts

Scripts specific to the Questro Desktop application (macOS native app).

## Available Scripts

### Installation and Setup
- **`install.sh`** - Install Questro Desktop application
- **`show-desktop.sh`** - Display desktop application interface

### Demo and Testing
- **`auto-demo.sh`** - Automated desktop application demo
- **`demo-voice-integration.sh`** - Voice integration demonstration

## Usage Examples

### Installation
```bash
# Install desktop application
./scripts/desktop/install.sh

# Show desktop interface
./scripts/desktop/show-desktop.sh
```

### Demo and Testing
```bash
# Run automated demo
./scripts/desktop/auto-demo.sh

# Demo voice integration
./scripts/desktop/demo-voice-integration.sh
```

## Desktop Application Overview

### Features
- **Native macOS Interface**: SwiftUI-based native application
- **Device Connectivity**: Connect to iOS/Android devices
- **Voice Integration**: Voice command processing
- **Real-time Sync**: Synchronization with cloud platform
- **Local Agent**: Background service for device management

### Architecture
```
Desktop App
├── SwiftUI Interface     # Native macOS UI
├── Local Agent          # Background service
├── Device Manager       # iOS/Android connectivity
├── Voice Processor      # Voice command handling
└── Sync Engine         # Cloud synchronization
```

## Installation Process

### Prerequisites
- macOS 12.0 or later
- Xcode Command Line Tools
- Active internet connection
- Admin privileges for installation

### Installation Steps
1. **Download**: Application bundle from releases
2. **Install**: Run installation script
3. **Setup**: Configure initial settings
4. **Connect**: Link to cloud account
5. **Verify**: Test basic functionality

### Post-Installation
```bash
# Verify installation
./scripts/desktop/show-desktop.sh

# Run initial demo
./scripts/desktop/auto-demo.sh
```

## Voice Integration

### Voice Features
- **Natural Language**: Convert speech to test commands
- **Command Recognition**: Recognize testing-specific commands
- **Feedback**: Audio and visual feedback
- **Continuous Listening**: Background voice monitoring

### Voice Commands
- "Start recording on device"
- "Run test suite"
- "Connect to iPhone"
- "Show test results"
- "Export test data"

### Demo Script
```bash
# Demo voice integration
./scripts/desktop/demo-voice-integration.sh

# Test specific voice commands
./scripts/desktop/demo-voice-integration.sh --command "start recording"
```

## Device Connectivity

### Supported Devices
- **iOS Devices**: iPhone, iPad (iOS 14+)
- **Android Devices**: Android 8.0+
- **Simulators**: iOS Simulator, Android Emulator

### Connection Methods
- **USB**: Direct USB connection
- **WiFi**: Wireless connection on same network
- **Cloud**: Remote device access via cloud

### Device Management
```bash
# List connected devices
./scripts/desktop/show-desktop.sh --devices

# Test device connectivity
./scripts/desktop/auto-demo.sh --test-devices
```

## Local Agent

### Agent Features
- **Background Service**: Runs in background
- **Device Discovery**: Automatic device detection
- **Test Execution**: Local test execution
- **Data Sync**: Synchronize with cloud platform

### Agent Management
```bash
# Start local agent
./scripts/desktop/install.sh --start-agent

# Check agent status
./scripts/desktop/show-desktop.sh --agent-status
```

## Configuration

### Application Settings
```bash
# Configuration file location
~/Library/Application Support/Questro/config.json

# Default settings
{
  "voiceEnabled": true,
  "autoConnect": true,
  "syncInterval": 30,
  "deviceDiscovery": true
}
```

### Environment Variables
```bash
# Desktop app configuration
QUESTRO_DESKTOP_MODE=production
QUESTRO_CLOUD_URL=https://api.questro.com
QUESTRO_VOICE_ENABLED=true
QUESTRO_AUTO_SYNC=true
```

## Troubleshooting

### Common Issues

#### Installation Problems
```bash
# Check system requirements
system_profiler SPSoftwareDataType

# Verify permissions
ls -la /Applications/Questro.app

# Reinstall if needed
./scripts/desktop/install.sh --force
```

#### Device Connection Issues
```bash
# Check USB connection
system_profiler SPUSBDataType | grep -i device

# Test network connectivity
ping device-ip-address

# Reset device connection
./scripts/desktop/auto-demo.sh --reset-devices
```

#### Voice Integration Problems
```bash
# Check microphone permissions
tccutil reset Microphone com.questro.desktop

# Test voice recognition
./scripts/desktop/demo-voice-integration.sh --test-mic

# Reset voice settings
./scripts/desktop/install.sh --reset-voice
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=true ./scripts/desktop/auto-demo.sh

# Verbose output
VERBOSE=true ./scripts/desktop/show-desktop.sh
```

### Log Files
```bash
# Application logs
~/Library/Logs/Questro/app.log

# Agent logs
~/Library/Logs/Questro/agent.log

# Voice logs
~/Library/Logs/Questro/voice.log
```

## Development

### Building from Source
```bash
# Clone repository
git clone https://github.com/questro/questro-desktop.git

# Build application
cd QestroDesktop
xcodebuild -scheme Questro -configuration Release

# Install development build
./scripts/desktop/install.sh --dev
```

### Testing
```bash
# Run unit tests
xcodebuild test -scheme QuestroTests

# Run integration tests
./scripts/desktop/auto-demo.sh --test-all

# Performance testing
./scripts/desktop/auto-demo.sh --benchmark
```

## Security

### Permissions
- **Microphone**: Voice command processing
- **Camera**: Device screen recording
- **Network**: Cloud synchronization
- **USB**: Device connectivity

### Data Protection
- **Local Encryption**: Sensitive data encrypted locally
- **Secure Transmission**: TLS encryption for cloud sync
- **Access Control**: User authentication required
- **Privacy**: No data collection without consent

### Security Best Practices
- Keep application updated
- Use strong authentication
- Review permissions regularly
- Monitor network connections
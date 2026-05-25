# Luna GLM Vision MCP Server

🚀 **GLM-4.5V powered GUI testing and automation agent for the Luna ecosystem**

## Overview

Luna GLM Vision is a comprehensive MCP (Model Context Protocol) server that leverages the GLM-4.5V multimodal model to provide intelligent GUI testing, automation, and visual analysis capabilities. It can recognize screen content, execute UI commands, and perform automated testing workflows.

## ✨ Features

### Core Capabilities
- **📸 Visual Screen Analysis**: Recognize and process screen images and UI elements
- **🖱️ GUI Automation**: Execute click, swipe, and keyboard commands
- **🧪 UI Testing**: Automated user interface and user experience testing
- **🔍 Visual Regression Testing**: Compare screenshots and detect UI changes
- **📱 Cross-Platform Support**: Web, mobile, and desktop application testing
- **♿ Accessibility Testing**: WCAG compliance and accessibility validation
- **📊 Comprehensive Reporting**: HTML, JSON, and Markdown test reports

### Technical Specifications
- **Model**: GLM-4.5V (Vision-Language Model)
- **Cost**: $0.6/million input tokens, $1.8/million output tokens
- **Thinking Mode**: Enhanced reasoning for complex UI interactions
- **Multi-Language**: Support for cURL, Python, and Java SDK implementations

## 🛠️ Installation

### Prerequisites

- Node.js 18 or higher
- GLM API key (get one at [Zhipu AI](https://open.bigmodel.cn/))
- Platform-specific screenshot tools:
  - **macOS**: Built-in `screencapture` and `cliclick` (install with `brew install cliclick`)
  - **Linux**: ImageMagick `import` and `xdotool` (install with `sudo apt-get install imagemagick xdotool`)
  - **Windows**: Additional setup required (limited support)

### Quick Install

```bash
# Clone and navigate to the server directory
cd mcp-servers/luna-glm-vision

# Run the installation script
./install.sh
```

### Manual Install

```bash
# Install dependencies
npm install

# Create configuration
cp .env.example .env
# Edit .env with your GLM API key

# Run tests
npm test
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# Required
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4.5v

# Optional
GLM_TIMEOUT=30000
GLM_MAX_RETRIES=3
GLM_THINKING_MODE=true
GLM_SCREENSHOT_QUALITY=90
GLM_TEST_REPORTS_DIR=./test-reports
GLM_DEBUG=false
```

### Getting Your GLM API Key

1. Visit [Zhipu AI Open Platform](https://open.bigmodel.cn/)
2. Register and verify your account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env` file

## 🚀 Getting Started

### 1. Start the Server

```bash
# Using the startup script
./start-server.sh

# Or directly
node index.js
```

### 2. Test Basic Functionality

```bash
# Test server connection
/luna-glm-setup

# Capture your first screenshot
/luna-glm-capture

# Analyze UI elements
/luna-glm-analyze elements

# Run a simple test
/luna-glm-test login-flow
```

### 3. Integrate with Luna Commands

The GLM Vision server integrates seamlessly with existing Luna commands:

```bash
# Enhanced testing with GUI capabilities
/luna-test --type=gui --scenario=login-flow

# Code review with UI analysis
/luna-review --include-ui --accessibility-check

# Safe deployment with UI validation
/luna-deploy --pre-deploy-tests=gui --visual-regression-check
```

## 📋 Available Tools

### Setup & Configuration

#### `glm_setup`
Initialize and configure GLM Vision agent.

```json
{
  "name": "glm_setup",
  "arguments": {
    "api_key": "your_glm_api_key",
    "base_url": "https://open.bigmodel.cn/api/paas/v4",
    "thinking_mode": true
  }
}
```

### Screen & Analysis

#### `glm_capture_screen`
Capture and analyze screen or specific UI area.

```json
{
  "name": "glm_capture_screen",
  "arguments": {
    "area": {"x": 100, "y": 100, "width": 400, "height": 300},
    "quality": 90,
    "analyze": true
  }
}
```

#### `glm_analyze_ui`
Analyze UI elements and layout using GLM-4.5V.

```json
{
  "name": "glm_analyze_ui",
  "arguments": {
    "image_path": "./screenshot.png",
    "analysis_type": "elements",
    "context": "Mobile login screen"
  }
}
```

### Interaction & Automation

#### `glm_click_element`
Click on UI elements based on visual analysis.

```json
{
  "name": "glm_click_element",
  "arguments": {
    "element_description": "Submit button",
    "confidence_threshold": 0.7
  }
}
```

#### `glm_type_text`
Type text using keyboard input.

```json
{
  "name": "glm_type_text",
  "arguments": {
    "text": "user@example.com",
    "element_description": "Email input field",
    "clear_first": true
  }
}
```

#### `glm_swipe_gesture`
Perform swipe gestures for mobile testing.

```json
{
  "name": "glm_swipe_gesture",
  "arguments": {
    "start_x": 100,
    "start_y": 500,
    "end_x": 100,
    "end_y": 100,
    "duration": 500
  }
}
```

### Testing Workflows

#### `glm_run_ui_test`
Run comprehensive UI testing workflows.

```json
{
  "name": "glm_run_ui_test",
  "arguments": {
    "test_scenario": "User registration flow",
    "steps": [
      {"action": "capture", "parameters": {"analyze": true}},
      {"action": "click", "parameters": {"element_description": "Sign up button"}},
      {"action": "type", "parameters": {"text": "test@example.com", "element_description": "Email field"}},
      {"action": "click", "parameters": {"element_description": "Create account button"}}
    ],
    "generate_report": true
  }
}
```

#### `glm_visual_regression_test`
Compare screenshots for visual regression testing.

```json
{
  "name": "glm_visual_regression_test",
  "arguments": {
    "baseline_image": "./baseline.png",
    "current_image": "./current.png",
    "threshold": 0.1,
    "generate_diff": true
  }
}
```

### Reporting

#### `glm_generate_test_report`
Generate comprehensive test reports.

```json
{
  "name": "glm_generate_test_report",
  "arguments": {
    "test_results": [...],
    "screenshots": ["./screenshot1.png", "./screenshot2.png"],
    "format": "html",
    "output_path": "./test-report.html"
  }
}
```

## 🔧 Luna Command Integration

### Enhanced Commands

The GLM Vision server enhances existing Luna commands:

#### Enhanced `/luna-test`
```bash
/luna-test --type=gui --scenario=login-flow
/luna-test --type=visual-regression --baseline=./screenshots/
/luna-test --type=accessibility --standard=wcag-aa
```

#### Enhanced `/luna-review`
```bash
/luna-review --include-ui --accessibility-check
/luna-review --design-system-validation
```

#### Enhanced `/luna-deploy`
```bash
/luna-deploy --pre-deploy-tests=gui --fail-on-ui-errors
/luna-deploy --visual-regression-check
```

### GLM Vision Specific Commands

#### Quick Commands
```bash
/luna-glm-setup              # Initial setup
/luna-glm-capture            # Quick screenshot
/luna-glm-test login-flow   # Test common workflow
/luna-glm-report            # Generate report
```

#### Advanced Commands
```bash
/luna-glm-click "Submit button"     # Element interaction
/luna-glm-type "user@example.com"   # Text input
/luna-glm-analyze accessibility    # Accessibility analysis
/luna-glm-compare before.png after.png  # Visual regression
```

## 📊 Use Cases

### 1. Web Application Testing

```bash
# Test login flow
/luna-glm-test login-flow --platform=web

# Form validation testing
/luna-glm-test form-validation --fields=email,password,confirm-password

# Navigation testing
/luna-glm-test navigation --pages=home,about,contact
```

### 2. Mobile App Testing

```bash
# Touch gesture testing
/luna-glm-swipe 100 500 100 100 --duration=300

# Mobile-specific UI testing
/luna-glm-test mobile-ui --device=iphone --orientation=portrait

# Responsive design testing
/luna-glm-test responsive --viewports=mobile,tablet,desktop
```

### 3. Visual Regression Testing

```bash
# Set up baseline
/luna-glm-capture --baseline

# Compare with current state
/luna-glm-compare baseline.png current.png --threshold=0.05

# Generate regression report
/luna-glm-report --type=visual-regression
```

### 4. Accessibility Testing

```bash
# WCAG compliance check
/luna-glm-analyze accessibility --standard=wcag-aa

# Keyboard navigation testing
/luna-glm-test accessibility --focus=keyboard-navigation

# Color contrast analysis
/luna-glm-analyze accessibility --focus=color-contrast
```

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: UI Tests with GLM Vision

on: [push, pull_request]

jobs:
  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install GLM Vision
        run: |
          cd mcp-servers/luna-glm-vision
          npm install

      - name: Run GUI Tests
        env:
          GLM_API_KEY: ${{ secrets.GLM_API_KEY }}
        run: |
          cd mcp-servers/luna-glm-vision
          /luna-glm-test --type=gui --scenario=smoke-tests

      - name: Visual Regression
        env:
          GLM_API_KEY: ${{ secrets.GLM_API_KEY }}
        run: |
          cd mcp-servers/luna-glm-vision
          /luna-glm-compare baseline.png current.png --fail-on-diff
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    stages {
        stage('UI Testing') {
            steps {
                sh 'cd mcp-servers/luna-glm-vision && npm install'
                sh '/luna-glm-setup'
                sh '/luna-test --type=gui --scenario=smoke-tests'
                sh '/luna-glm-analyze accessibility --strict'
            }
        }
    }
}
```

## 🐛 Troubleshooting

### Common Issues

#### API Key Problems
```bash
# Check API key configuration
/luna-glm-setup --check-api

# Test connection
/luna-glm-setup --test-connection-only
```

#### Screenshot Permissions
```bash
# Check permissions on macOS
./install.sh --check-permissions

# Test screenshot capture
/luna-glm-capture --test-mode
```

#### Element Detection Issues
```bash
# Lower confidence threshold for better detection
/luna-glm-click "button" --confidence=0.5

# Debug mode for element detection
/luna-glm-test --debug-mode --verbose-logging
```

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
export GLM_DEBUG=true
/luna-glm-test debug --verbose
```

### Performance Optimization

```bash
# Fast mode for quick testing
/luna-test --type=gui --fast-mode --reduced-screenshots

# Lower resolution for faster analysis
/luna-glm-analyze --quick-scan --low-resolution
```

## 📈 Performance Metrics

### Typical Performance
- **Screenshot Capture**: 1-2 seconds
- **UI Analysis**: 3-5 seconds
- **Element Detection**: 2-4 seconds
- **Full Test Workflow**: 10-30 seconds (depending on complexity)

### Cost Optimization
- Use thinking mode for complex scenarios only
- Optimize screenshot quality vs. analysis needs
- Batch multiple analyses when possible
- Cache results for repeated tests

## 🔐 Security & Privacy

### Data Protection
- Screenshots processed locally when possible
- Secure API transmission to GLM services
- Configurable data retention policies
- GDPR and CCPA compliance considerations

### Access Control
- API key authentication required
- Configurable permission levels
- Audit logging for all interactions
- Role-based access control

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- [GLM-4.5V Documentation](https://docs.z.ai/guides/vlm/glm-4.5v)
- [Luna Agents Documentation](../../README.md)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Issues & Support](https://github.com/luna-agents/luna-glm-vision/issues)

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the agent specification at `../../agents/luna-glm-vision.md`

---

**Made with ❤️ by the Luna Agents team**
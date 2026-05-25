# Demo Directory

This directory contains demonstration files, examples, and sample implementations for the qestro platform.

## Directory Structure

```
demo/
├── html/              # HTML demo files and test pages
├── examples/          # Code examples and sample implementations
└── README.md          # This file
```

## Demo Categories

### HTML Demos (`html/`)
Interactive HTML demonstrations and test pages:

- **`test-page.html`** - Basic test page for browser automation testing
- **`playback-test.html`** - Test page for recording playback functionality
- **`demo-website.html`** - Sample website for demonstration purposes
- **`qestro-recording-demo.html`** - qestro recording feature demonstration

### Code Examples (`examples/`)
Sample code implementations and examples:

- **`demo-desktop-ui.swift`** - Desktop UI demonstration code
- **`interactive-demo.swift`** - Interactive demo implementation

## Usage

### HTML Demos
The HTML demo files can be used for:

1. **Browser Testing**: Test browser automation features
2. **Recording Demos**: Demonstrate recording capabilities
3. **UI Testing**: Test user interface interactions
4. **Integration Testing**: Test end-to-end workflows

#### Running HTML Demos
```bash
# Serve demo files locally
cd demo/html
python -m http.server 8080

# Or use Node.js
npx serve .

# Access demos at http://localhost:8080
```

### Code Examples
The code examples demonstrate:

1. **Desktop Integration**: Native desktop application features
2. **UI Patterns**: Common user interface patterns
3. **API Usage**: How to use qestro APIs
4. **Best Practices**: Recommended implementation approaches

#### Using Code Examples
```bash
# Swift examples (for desktop app)
cd demo/examples
swift demo-desktop-ui.swift

# Copy examples to your project
cp demo/examples/interactive-demo.swift YourProject/
```

## Demo Scenarios

### Recording Workflow Demo
1. Open `qestro-recording-demo.html`
2. Start recording session
3. Interact with page elements
4. Stop recording and review

### Browser Testing Demo
1. Use `test-page.html` as target
2. Run browser automation scripts
3. Verify element interactions
4. Check test results

### Desktop Integration Demo
1. Run desktop application
2. Load `demo-desktop-ui.swift` example
3. Test device connectivity
4. Demonstrate voice integration

## Demo Scripts

Related demo scripts are available in the scripts directory:

```bash
# Development demos
./scripts/development/demo.sh

# Desktop demos
./scripts/desktop/auto-demo.sh
./scripts/desktop/demo-voice-integration.sh
```

## Creating New Demos

### HTML Demo Guidelines
1. **Self-contained**: Include all necessary resources
2. **Interactive**: Provide interactive elements for testing
3. **Documented**: Include comments explaining functionality
4. **Responsive**: Work across different screen sizes

### Code Example Guidelines
1. **Clear Purpose**: Each example should demonstrate specific functionality
2. **Well-commented**: Include explanatory comments
3. **Runnable**: Examples should be executable as-is
4. **Best Practices**: Follow coding standards and best practices

### Demo File Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo: [Feature Name]</title>
    <style>
        /* Demo-specific styles */
    </style>
</head>
<body>
    <h1>qestro Demo: [Feature Name]</h1>
    
    <!-- Demo content -->
    <div id="demo-container">
        <!-- Interactive elements -->
    </div>
    
    <script>
        // Demo functionality
    </script>
</body>
</html>
```

## Demo Data

### Test Data
- Use realistic but anonymized data
- Include edge cases and error scenarios
- Provide data in multiple formats (JSON, CSV, etc.)

### Sample Configurations
- Example environment configurations
- Sample API responses
- Mock service configurations

## Integration with Testing

### Automated Testing
Demo files are used in automated testing:
- Browser automation tests
- Visual regression testing
- Performance testing
- Accessibility testing

### Manual Testing
Demo files support manual testing:
- Feature validation
- User experience testing
- Cross-browser compatibility
- Mobile responsiveness

## Maintenance

### Regular Updates
- Keep demos current with latest features
- Update examples when APIs change
- Refresh sample data periodically
- Test demos with each release

### Quality Assurance
- Verify all demos work correctly
- Check for broken links or resources
- Validate HTML and CSS
- Test across different browsers

## Contributing

When adding new demos:
1. Place in appropriate subdirectory
2. Follow naming conventions
3. Include documentation
4. Test thoroughly
5. Update this README

### Demo Naming Conventions
- Use descriptive names
- Include feature or purpose
- Use kebab-case for files
- Add appropriate file extensions

---

For more information about using demos in development and testing, see the [Development Documentation](../docs/development/) and [Testing Documentation](../docs/testing/).
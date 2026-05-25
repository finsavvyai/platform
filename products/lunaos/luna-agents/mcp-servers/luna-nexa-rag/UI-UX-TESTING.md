# 🎨 UI/UX Testing with Apple HIG Compliance

## Overview

Luna RAG now includes comprehensive UI/UX testing capabilities with a focus on **Apple Human Interface Guidelines (HIG)** compliance, screenshot analysis, and responsiveness testing.

---

## 🆕 New UI/UX Tools (7 Total)

### 1. `ui_capture_screenshot`
**Capture screenshots of any URL for analysis**

```javascript
{
  "url": "http://localhost:3000",
  "outputPath": "./screenshots/capture.png",
  "viewport": { "width": 1920, "height": 1080 },
  "waitForSelector": ".main-content" // optional
}
```

**Features:**
- Full-page screenshots
- Custom viewport sizes
- Wait for specific elements
- Automatic directory creation

---

### 2. `ui_analyze_screenshot_hig`
**Apple HIG compliance analysis with AI**

```javascript
{
  "screenshotPath": "./screenshots/app.png",
  "platform": "ios", // "ios", "macos", "ipados", "watchos"
  "checkAreas": ["buttons", "typography", "spacing", "colors"]
}
```

**Apple HIG Guidelines Checked:**
- **iOS**: 44x44pt minimum touch targets
- **macOS**: 28x28pt minimum click targets
- **Typography**: SF Pro font usage, Dynamic Type
- **Spacing**: 8pt grid system
- **Colors**: System colors, Dark Mode support
- **Navigation**: Proper patterns (tab bars, navigation bars)
- **Accessibility**: VoiceOver support, contrast ratios

**Output:**
- ✅ Compliant | ⚠️ Needs Improvement | ❌ Non-Compliant
- Specific recommendations with code examples

---

### 3. `ui_test_responsiveness`
**Test across multiple device sizes**

```javascript
{
  "url": "https://myapp.com",
  "devices": ["iPhone 14 Pro", "iPad Pro", "Desktop 1920x1080"],
  "outputDir": "./screenshots/responsive"
}
```

**Supported Devices:**
- iPhone 14 Pro (393x852)
- iPhone SE (375x667)
- iPad Pro (1024x1366)
- iPad Air (820x1180)
- Desktop 1920x1080
- Desktop 1440x900

**Output:**
- Screenshots for each device
- Viewport dimensions
- Test status report

---

### 4. `ui_check_button_sizes`
**Validate button sizes against Apple HIG**

```javascript
{
  "screenshotPath": "./screenshots/buttons.png",
  "platform": "ios"
}
```

**Validates:**
- Minimum touch target sizes (44x44pt for iOS)
- Button spacing
- Accessibility compliance
- Interactive element sizing

**Output:**
- Table of all interactive elements
- Size compliance status
- Recommendations for non-compliant elements

---

### 5. `ui_accessibility_audit`
**Comprehensive WCAG & Apple accessibility audit**

```javascript
{
  "screenshotPath": "./screenshots/form.png",
  "url": "https://myapp.com/form", // optional for DOM analysis
  "standards": ["WCAG_2.1_AA", "Apple_HIG"]
}
```

**Standards Supported:**
- WCAG 2.1 Level AA
- WCAG 2.1 Level AAA
- Apple HIG Accessibility
- Section 508

**Checks:**
1. **Color Contrast**: 4.5:1 for text, 3:1 for large text
2. **Touch Targets**: Minimum sizes per platform
3. **Visual Hierarchy**: Logical structure
4. **Screen Reader**: Alt text, ARIA labels
5. **Keyboard Navigation**: Focus order, skip links
6. **Motion**: Reduced motion support

**Output:**
- Severity ratings (🔴 Critical | 🟡 High | 🟢 Medium | 🔵 Low)
- WCAG criterion violated
- Fix recommendations with code
- Overall accessibility score (0-100)

---

### 6. `ui_compare_design_systems`
**Compare against major design systems**

```javascript
{
  "screenshotPath": "./screenshots/interface.png",
  "designSystem": "Apple_HIG" // or "Material_Design", "Fluent", "Tailwind"
}
```

**Design Systems:**
- Apple Human Interface Guidelines
- Google Material Design 3
- Microsoft Fluent Design System
- Tailwind CSS Design Principles
- IBM Carbon Design System

**Analysis Areas:**
- Visual style matching
- Component usage
- Typography compliance
- Color system adherence
- Spacing consistency
- Icon style
- Elevation/shadows
- Motion principles

---

### 7. `ui_generate_test_report`
**Comprehensive UI/UX test suite with HTML report**

```javascript
{
  "url": "https://myapp.com",
  "testSuite": "complete", // "complete", "hig_compliance", "accessibility", "responsive"
  "outputDir": "./test-reports"
}
```

**Test Suites:**
- **complete**: All tests (HIG, accessibility, responsive)
- **hig_compliance**: Apple HIG compliance only
- **accessibility**: WCAG audit only
- **responsive**: Device testing only

**Output:**
- HTML report with Apple-style design
- Screenshots for all tests
- Detailed findings
- Pass/fail summary

---

## 🍎 Apple HIG Compliance Details

### iOS Guidelines
```
Touch Targets: 44x44 points minimum
Typography: SF Pro, Dynamic Type
Spacing: 8pt grid system
Colors: System colors + Dark Mode
Navigation: Tab bars, navigation bars
Buttons: Clear, recognizable, properly sized
Accessibility: VoiceOver, color contrast
```

### macOS Guidelines
```
Click Targets: 28x28 points minimum
Typography: SF Pro, clear hierarchy
Spacing: Consistent padding/margins
Windows: Toolbar, sidebar layouts
Controls: Native macOS controls
Accessibility: VoiceOver, keyboard navigation
```

### iPadOS Guidelines
```
Touch Targets: 44x44 points minimum
Multi-tasking: Split View, Slide Over
Pointer: Trackpad/mouse support
Typography: SF Pro, adaptive layouts
Spacing: Utilize screen space effectively
```

---

## 📱 Workflow Examples

### Workflow 1: Complete UI/UX Audit

```bash
# 1. Capture screenshot
ui_capture_screenshot {
  "url": "http://localhost:3000"
}

# 2. Check Apple HIG compliance
ui_analyze_screenshot_hig {
  "screenshotPath": "./screenshots/capture.png",
  "platform": "ios"
}

# 3. Test responsiveness
ui_test_responsiveness {
  "url": "http://localhost:3000",
  "devices": ["iPhone 14 Pro", "iPad Pro", "Desktop 1920x1080"]
}

# 4. Accessibility audit
ui_accessibility_audit {
  "screenshotPath": "./screenshots/capture.png",
  "standards": ["WCAG_2.1_AA", "Apple_HIG"]
}

# 5. Generate comprehensive report
ui_generate_test_report {
  "url": "http://localhost:3000",
  "testSuite": "complete"
}
```

---

### Workflow 2: Button Size Validation

```bash
# 1. Capture interface
ui_capture_screenshot {
  "url": "http://localhost:3000/buttons"
}

# 2. Check button sizes
ui_check_button_sizes {
  "screenshotPath": "./screenshots/capture.png",
  "platform": "ios"
}

# Output will show:
# | Element | Size | Compliance | Recommendation |
# |---------|------|------------|----------------|
# | Login Button | 42x42pt | ❌ Too small | Increase to 44x44pt |
# | Icon Button | 48x48pt | ✅ Compliant | - |
```

---

### Workflow 3: Design System Comparison

```bash
# Compare against Apple HIG
ui_compare_design_systems {
  "screenshotPath": "./screenshots/app.png",
  "designSystem": "Apple_HIG"
}

# Compare against Material Design
ui_compare_design_systems {
  "screenshotPath": "./screenshots/app.png",
  "designSystem": "Material_Design"
}
```

---

## 🚀 Cloudflare Workers Support

Deploy UI/UX testing to Cloudflare Workers for serverless testing!

### Setup

1. Install Wrangler:
```bash
npm install -g wrangler
```

2. Configure `wrangler.toml`:
```toml
name = "luna-ui-testing"
main = "index.js"
compatibility_date = "2024-01-01"

[env.production]
workers_dev = false
routes = ["ui-testing.yourdomain.com/*"]
```

3. Deploy:
```bash
wrangler deploy
```

### Benefits of Cloudflare Workers:
- **Global**: Test from multiple regions
- **Fast**: Edge computing for quick results
- **Scalable**: Handle multiple tests simultaneously
- **Cost-effective**: Pay only for what you use
- **No servers**: Fully serverless architecture

---

## 🎯 Use Cases

### 1. Pre-Release Testing
Test your app against Apple HIG before App Store submission

### 2. CI/CD Integration
Automated UI/UX testing in your deployment pipeline

### 3. Accessibility Compliance
Ensure WCAG 2.1 AA compliance for all users

### 4. Cross-Device Testing
Verify responsive design across devices

### 5. Design System Adherence
Maintain consistency with your design system

---

## 📊 Test Report Example

Generated HTML reports include:
- 🎨 Apple-style design
- 📸 Screenshots from all tests
- ✅ Pass/fail indicators
- 📈 Accessibility scores
- 🔍 Detailed findings
- 💡 Actionable recommendations
- 📝 Code examples for fixes

---

## 🛠️ Technical Stack

- **Puppeteer**: Chromium-based screenshot capture
- **Playwright**: Multi-browser testing
- **Sharp**: Image processing
- **LangChain**: AI-powered analysis
- **Nexa**: Local LLM for privacy
- **ChromaDB**: Context retrieval

---

## 💡 Pro Tips

1. **Start with screenshots**: Always capture first for reproducibility
2. **Test early**: Catch UI issues before development completes
3. **Automate**: Integrate into CI/CD for continuous validation
4. **Compare**: Use design system comparison for consistency
5. **Iterate**: Run tests after each UI change
6. **Document**: Generate reports for team review
7. **Accessibility first**: Make it a priority, not an afterthought

---

## 🔮 Coming Soon

- **Visual regression testing**: Compare screenshots over time
- **Performance metrics**: Core Web Vitals integration
- **AI-powered fixes**: Auto-generate code fixes
- **Multi-platform support**: Android, Web, Desktop
- **Video recording**: Capture interaction flows
- **A/B testing**: Compare design variations

---

## 📞 Support

For issues or questions:
- Check console logs for detailed error messages
- Verify Nexa server is running
- Ensure proper file permissions
- Review screenshot paths

---

**Built with ❤️ for developers who care about UI/UX quality and Apple HIG compliance**

Enjoy pixel-perfect, accessible, and beautiful user interfaces! 🎨✨

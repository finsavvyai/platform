# Questro Web Recording Architecture

## 🌐 How Web Recording Works in Questro

Questro provides multiple approaches for recording web browser interactions, making it flexible for different use cases and technical preferences.

## 🎯 Recording Methods

### 1. **Browser Extension Method** (Recommended)
- Chrome/Firefox extension that records user interactions
- Works in any website without installation
- Exports to multiple formats (Puppeteer, Playwright, Selenium)

### 2. **Cloud Browser Recording**
- Puppeteer-powered cloud browsers
- Record interactions through Questro dashboard
- Real-time streaming to web interface

### 3. **Local Agent Recording**
- Questro agent controls local browsers
- Records interactions on local machine
- Syncs recordings to cloud platform

---

## 🔧 Implementation Details

### Browser Extension Architecture

```javascript
// Content Script (Injected into web pages)
class QuestroRecorder {
  constructor() {
    this.recording = false;
    this.actions = [];
    this.startTime = null;
  }

  startRecording() {
    this.recording = true;
    this.startTime = Date.now();
    this.setupEventListeners();
    this.sendToBackground({ type: 'RECORDING_STARTED' });
  }

  setupEventListeners() {
    // Mouse events
    document.addEventListener('click', this.recordClick.bind(this));
    document.addEventListener('mouseover', this.recordHover.bind(this));
    
    // Keyboard events
    document.addEventListener('keydown', this.recordKeydown.bind(this));
    document.addEventListener('input', this.recordInput.bind(this));
    
    // Form events
    document.addEventListener('submit', this.recordSubmit.bind(this));
    document.addEventListener('change', this.recordChange.bind(this));
    
    // Navigation events
    window.addEventListener('beforeunload', this.recordNavigation.bind(this));
    
    // Scroll events
    document.addEventListener('scroll', this.recordScroll.bind(this));
  }

  recordClick(event) {
    if (!this.recording) return;
    
    const element = event.target;
    const selector = this.generateSelector(element);
    const action = {
      type: 'click',
      timestamp: Date.now() - this.startTime,
      selector: selector,
      coordinates: { x: event.clientX, y: event.clientY },
      element: {
        tagName: element.tagName,
        text: element.textContent?.trim(),
        attributes: this.getElementAttributes(element)
      },
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight }
    };
    
    this.actions.push(action);
    this.sendToBackground({ type: 'ACTION_RECORDED', action });
  }

  recordInput(event) {
    if (!this.recording) return;
    
    const element = event.target;
    const selector = this.generateSelector(element);
    const action = {
      type: 'input',
      timestamp: Date.now() - this.startTime,
      selector: selector,
      value: element.value,
      element: {
        tagName: element.tagName,
        type: element.type,
        placeholder: element.placeholder
      },
      url: window.location.href
    };
    
    this.actions.push(action);
    this.sendToBackground({ type: 'ACTION_RECORDED', action });
  }

  generateSelector(element) {
    // Priority order for selector generation
    const selectors = [];
    
    // 1. ID selector (most reliable)
    if (element.id) {
      selectors.push(`#${element.id}`);
    }
    
    // 2. Data attribute selectors
    const dataTestId = element.getAttribute('data-testid') || 
                      element.getAttribute('data-test') ||
                      element.getAttribute('data-cy');
    if (dataTestId) {
      selectors.push(`[data-testid="${dataTestId}"]`);
    }
    
    // 3. Aria label selectors
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      selectors.push(`[aria-label="${ariaLabel}"]`);
    }
    
    // 4. Text-based selectors for buttons/links
    if (['BUTTON', 'A'].includes(element.tagName) && element.textContent) {
      const text = element.textContent.trim();
      selectors.push(`${element.tagName.toLowerCase()}:contains("${text}")`);
    }
    
    // 5. CSS selector path
    selectors.push(this.getCSSPath(element));
    
    return {
      primary: selectors[0],
      fallbacks: selectors.slice(1)
    };
  }

  getCSSPath(element) {
    const path = [];
    while (element && element.nodeType === Node.ELEMENT_NODE) {
      let selector = element.tagName.toLowerCase();
      
      if (element.id) {
        selector += `#${element.id}`;
        path.unshift(selector);
        break;
      }
      
      if (element.className) {
        const classes = element.className.split(' ').filter(c => c);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }
      
      // Add nth-child if needed for uniqueness
      const siblings = Array.from(element.parentNode?.children || []);
      const sameTagSiblings = siblings.filter(s => s.tagName === element.tagName);
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(element) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      element = element.parentNode;
    }
    
    return path.join(' > ');
  }
}
```

### Cloud Browser Implementation

```javascript
// Backend service for cloud browser recording
class CloudBrowserRecorder {
  constructor() {
    this.puppeteer = require('puppeteer');
    this.activeRecordings = new Map();
  }

  async startCloudRecording(sessionId, config) {
    const browser = await this.puppeteer.launch({
      headless: false, // For recording with visual feedback
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport(config.viewport || { width: 1920, height: 1080 });
    
    const recording = {
      browser,
      page,
      actions: [],
      startTime: Date.now()
    };
    
    // Set up recording listeners
    await this.setupPuppeteerRecording(page, sessionId);
    
    // Navigate to initial URL
    if (config.url) {
      await page.goto(config.url);
    }
    
    this.activeRecordings.set(sessionId, recording);
    
    return {
      sessionId,
      browserUrl: await this.getBrowserWSEndpoint(browser),
      status: 'recording'
    };
  }

  async setupPuppeteerRecording(page, sessionId) {
    // Inject recording script into page
    await page.evaluateOnNewDocument(() => {
      window.questroRecorder = new QuestroRecorder();
    });
    
    // Listen for console events (our recorder communicates via console)
    page.on('console', async (msg) => {
      if (msg.type() === 'log' && msg.text().startsWith('QUESTRO_ACTION:')) {
        const actionData = JSON.parse(msg.text().replace('QUESTRO_ACTION:', ''));
        await this.handleRecordedAction(sessionId, actionData);
      }
    });
    
    // Listen for navigation
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        await this.handleNavigation(sessionId, frame.url());
      }
    });
  }

  async handleRecordedAction(sessionId, action) {
    const recording = this.activeRecordings.get(sessionId);
    if (!recording) return;
    
    recording.actions.push(action);
    
    // Emit to WebSocket clients for real-time preview
    this.emitToClients(sessionId, {
      type: 'action_recorded',
      action: action,
      totalActions: recording.actions.length
    });
  }

  async stopCloudRecording(sessionId) {
    const recording = this.activeRecordings.get(sessionId);
    if (!recording) throw new Error('Recording not found');
    
    await recording.browser.close();
    this.activeRecordings.delete(sessionId);
    
    return {
      sessionId,
      actions: recording.actions,
      duration: Date.now() - recording.startTime,
      status: 'completed'
    };
  }
}
```

### Export Formats

```javascript
// Export recorded actions to different formats
class TestExporter {
  
  // Export to Puppeteer script
  exportToPuppeteer(actions, options = {}) {
    const { url, viewport = { width: 1920, height: 1080 } } = options;
    
    let script = `const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport(${JSON.stringify(viewport)});
  
`;

    if (url) {
      script += `  await page.goto('${url}');\n\n`;
    }

    actions.forEach((action, index) => {
      switch (action.type) {
        case 'click':
          script += `  // Step ${index + 1}: Click on ${action.element.tagName}\n`;
          script += `  await page.click('${action.selector.primary}');\n`;
          if (action.waitAfter) {
            script += `  await page.waitForTimeout(${action.waitAfter});\n`;
          }
          script += '\n';
          break;
          
        case 'input':
          script += `  // Step ${index + 1}: Type in ${action.element.tagName}\n`;
          script += `  await page.type('${action.selector.primary}', '${action.value}');\n\n`;
          break;
          
        case 'navigation':
          script += `  // Step ${index + 1}: Navigate to ${action.url}\n`;
          script += `  await page.goto('${action.url}');\n`;
          script += `  await page.waitForLoadState('networkidle');\n\n`;
          break;
          
        case 'scroll':
          script += `  // Step ${index + 1}: Scroll\n`;
          script += `  await page.evaluate(() => window.scrollBy(${action.deltaX}, ${action.deltaY}));\n\n`;
          break;
          
        case 'wait':
          script += `  // Step ${index + 1}: Wait\n`;
          script += `  await page.waitForTimeout(${action.duration});\n\n`;
          break;
      }
    });

    script += `  await browser.close();
})();`;

    return script;
  }

  // Export to Playwright script
  exportToPlaywright(actions, options = {}) {
    const { url, viewport = { width: 1920, height: 1080 } } = options;
    
    let script = `const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: ${JSON.stringify(viewport)}
  });
  const page = await context.newPage();
  
`;

    if (url) {
      script += `  await page.goto('${url}');\n\n`;
    }

    actions.forEach((action, index) => {
      switch (action.type) {
        case 'click':
          script += `  // Step ${index + 1}: Click on ${action.element.tagName}\n`;
          script += `  await page.click('${action.selector.primary}');\n\n`;
          break;
          
        case 'input':
          script += `  // Step ${index + 1}: Fill ${action.element.tagName}\n`;
          script += `  await page.fill('${action.selector.primary}', '${action.value}');\n\n`;
          break;
          
        case 'navigation':
          script += `  // Step ${index + 1}: Navigate to ${action.url}\n`;
          script += `  await page.goto('${action.url}');\n\n`;
          break;
      }
    });

    script += `  await browser.close();
})();`;

    return script;
  }

  // Export to Cypress script
  exportToCypress(actions, options = {}) {
    const { url } = options;
    
    let script = `describe('Recorded Test', () => {
  it('should complete user flow', () => {
`;

    if (url) {
      script += `    cy.visit('${url}');\n\n`;
    }

    actions.forEach((action, index) => {
      switch (action.type) {
        case 'click':
          script += `    // Step ${index + 1}: Click on ${action.element.tagName}\n`;
          script += `    cy.get('${action.selector.primary}').click();\n\n`;
          break;
          
        case 'input':
          script += `    // Step ${index + 1}: Type in ${action.element.tagName}\n`;
          script += `    cy.get('${action.selector.primary}').type('${action.value}');\n\n`;
          break;
          
        case 'navigation':
          script += `    // Step ${index + 1}: Navigate to ${action.url}\n`;
          script += `    cy.visit('${action.url}');\n\n`;
          break;
      }
    });

    script += `  });
});`;

    return script;
  }

  // Export to custom YAML format (workflow-use style)
  exportToWorkflowYAML(actions, options = {}) {
    const { url, name = 'Recorded Test' } = options;
    
    let yaml = `# Questro - Generated Web Test
# Recorded: ${new Date().toISOString()}
name: "${name}"
${url ? `url: "${url}"` : ''}
viewport:
  width: ${options.viewport?.width || 1920}
  height: ${options.viewport?.height || 1080}
steps:
`;

    actions.forEach((action, index) => {
      switch (action.type) {
        case 'click':
          yaml += `  - click:\n`;
          yaml += `      selector: "${action.selector.primary}"\n`;
          if (action.selector.fallbacks?.length > 0) {
            yaml += `      fallbacks:\n`;
            action.selector.fallbacks.forEach(fallback => {
              yaml += `        - "${fallback}"\n`;
            });
          }
          if (action.element.text) {
            yaml += `      text: "${action.element.text}"\n`;
          }
          yaml += '\n';
          break;
          
        case 'input':
          yaml += `  - type:\n`;
          yaml += `      selector: "${action.selector.primary}"\n`;
          yaml += `      text: "${action.value}"\n`;
          if (action.element.placeholder) {
            yaml += `      placeholder: "${action.element.placeholder}"\n`;
          }
          yaml += '\n';
          break;
          
        case 'navigation':
          yaml += `  - navigate:\n`;
          yaml += `      url: "${action.url}"\n\n`;
          break;
          
        case 'scroll':
          yaml += `  - scroll:\n`;
          yaml += `      direction: "${action.direction || 'down'}"\n`;
          yaml += `      amount: ${action.amount || 100}\n\n`;
          break;
          
        case 'wait':
          yaml += `  - wait: ${action.duration}\n\n`;
          break;
          
        case 'assert':
          yaml += `  - assert:\n`;
          yaml += `      selector: "${action.selector.primary}"\n`;
          yaml += `      ${action.assertion.type}: ${action.assertion.value}\n\n`;
          break;
      }
    });

    return yaml;
  }
}
```

---

## 🚀 How to Use Web Recording in Questro

### Method 1: Browser Extension (Easiest)

1. **Install Questro Browser Extension**
   ```bash
   # Available on Chrome Web Store and Firefox Add-ons
   # Or load unpacked extension from questro-extension/
   ```

2. **Start Recording**
   - Click Questro extension icon
   - Click "Start Recording"
   - Navigate and interact with your website
   - Extension captures all actions automatically

3. **Stop and Export**
   - Click "Stop Recording" 
   - Choose export format (Puppeteer, Playwright, Cypress, YAML)
   - Download or sync to Questro cloud

### Method 2: Cloud Browser Recording

1. **Open Questro Dashboard**
   ```
   https://app.questro.io
   ```

2. **Create New Web Recording**
   - Click "New Recording" → "Web"
   - Enter target URL
   - Set viewport size
   - Click "Start Cloud Recording"

3. **Record in Cloud Browser**
   - Cloud browser opens in iframe
   - Interact with website normally
   - Actions recorded automatically
   - Real-time preview in dashboard

4. **Export Test**
   - Stop recording
   - Review captured actions
   - Export to preferred format
   - Add to test suite

### Method 3: Local Agent Recording

1. **Install Questro Agent**
   ```bash
   npm install -g @questro/agent
   questro-agent login
   ```

2. **Start Local Recording**
   ```bash
   questro-agent record web --url https://yoursite.com
   ```

3. **Record Interactions**
   - Agent opens local browser
   - Interact with website
   - Actions sync to cloud in real-time

4. **Complete Recording**
   ```bash
   # Recording auto-stops when browser closes
   questro-agent export last-recording --format puppeteer
   ```

---

## 🎯 Advanced Features

### Smart Element Detection
- **Stable selectors**: Prioritizes data-testid, aria-labels, and IDs
- **Fallback selectors**: Multiple selector strategies for reliability
- **Self-healing**: Automatically tries fallback selectors if primary fails

### Real-time Collaboration
- **Live sharing**: Share recording sessions with team members
- **Comments**: Add annotations during recording
- **Review mode**: Review and edit actions before export

### AI-Powered Enhancements
- **Smart waits**: Automatically adds appropriate wait times
- **Assertion suggestions**: AI suggests assertions based on user behavior
- **Test optimization**: Removes redundant actions and optimizes flow

### Integration Options
- **CI/CD Integration**: Export tests directly to GitHub Actions
- **Test Framework Support**: Puppeteer, Playwright, Cypress, Selenium
- **Custom Formats**: Create custom export templates

---

## 📊 Workflow Example

```yaml
# Example: E-commerce checkout flow
name: "E-commerce Checkout Flow"
url: "https://shop.example.com"
viewport:
  width: 1920
  height: 1080
steps:
  - navigate:
      url: "https://shop.example.com/products"
  
  - click:
      selector: "[data-testid='product-1']"
      text: "Add to Cart"
  
  - click:
      selector: ".cart-icon"
  
  - assert:
      selector: ".cart-items"
      visible: true
  
  - click:
      selector: "[data-testid='checkout-button']"
      text: "Proceed to Checkout"
  
  - type:
      selector: "#email"
      text: "user@example.com"
  
  - type:
      selector: "#address"
      text: "123 Main St"
  
  - click:
      selector: "[data-testid='place-order']"
      text: "Place Order"
  
  - assert:
      selector: ".order-confirmation"
      contains: "Order confirmed"
  
  - screenshot: "order-complete"
```

This comprehensive web recording architecture makes Questro a powerful tool for web test automation, supporting multiple browsers, frameworks, and export formats while maintaining ease of use for both technical and non-technical users.
# Enhanced WebRecordingService Testing Guide

This guide provides multiple ways to test the enhanced WebRecordingService features we just implemented.

## 🚀 Quick Start Testing

### Option 1: Run the Integration Test Script

```bash
cd backend
npm run tsx src/test-enhanced-recording.ts
```

This script will test all the enhanced features in a controlled environment.

### Option 2: Manual API Testing with curl

Start the backend server and use these curl commands:

```bash
# 1. Start enhanced recording
curl -X POST http://localhost:3001/api/recording/start \
  -H "Content-Type: application/json" \
  -d '{
    "type": "web",
    "config": {
      "url": "https://example.com",
      "browser": "chrome",
      "cloudProvider": "local",
      "aiFeatures": {
        "smartSelectors": true,
        "assertionSuggestions": true,
        "elementHealing": true,
        "parameterDetection": true
      },
      "visualTesting": {
        "enableBaselines": true,
        "threshold": 0.1
      },
      "performance": {
        "collectMetrics": true,
        "thresholds": {
          "loadTime": 3000,
          "firstContentfulPaint": 1500
        }
      }
    }
  }'

# 2. Get session status
curl http://localhost:3001/api/recording/session/{sessionId}

# 3. Generate smart selectors
curl -X POST http://localhost:3001/api/recording/smart-selectors \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "element": {
      "tagName": "BUTTON",
      "text": "Submit",
      "attributes": {
        "id": "submit-btn",
        "class": "btn btn-primary"
      }
    },
    "coordinates": { "x": 100, "y": 200 }
  }'

# 4. Generate AI assertions
curl -X POST http://localhost:3001/api/recording/ai-assertions \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id",
    "action": {
      "id": "action-1",
      "type": "click",
      "timestamp": 1234567890,
      "selector": "#submit-btn"
    }
  }'

# 5. Detect parameters
curl -X POST http://localhost:3001/api/recording/detect-parameters \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id"
  }'

# 6. Get session analytics
curl http://localhost:3001/api/recording/analytics/{sessionId}

# 7. Export enhanced session
curl http://localhost:3001/api/recording/export/{sessionId}?format=json

# 8. Stop recording
curl -X POST http://localhost:3001/api/recording/stop \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "your-session-id"
  }'
```

### Option 3: Unit Tests

Run the specific unit tests for the enhanced services:

```bash
cd backend

# Run all enhanced recording tests
npm test -- --testNamePattern="Enhanced|Cloud|Smart|Assertion|Parameter"

# Run specific service tests
npm test -- --testPathPattern="EnhancedWebRecordingService"
npm test -- --testPathPattern="CloudTestingService"
npm test -- --testPathPattern="SmartSelectorService"
npm test -- --testPathPattern="AssertionSuggestionService"
npm test -- --testPathPattern="ParameterizationService"
```

## 🧪 Feature-Specific Testing

### 1. Smart Element Recognition

Test the intelligent selector generation:

```javascript
const element = {
  tagName: 'INPUT',
  type: 'email',
  attributes: {
    id: 'user-email',
    name: 'email',
    'data-testid': 'email-input',
    placeholder: 'Enter your email'
  }
};

// This should generate multiple selector strategies:
// - #user-email (ID - highest priority)
// - [data-testid="email-input"] (Test ID)
// - input[type="email"][name="email"] (Attribute combination)
// - AI-generated selector (if AI service is available)
```

### 2. AI Assertion Suggestions

Test automatic assertion generation:

```javascript
const action = {
  type: 'click',
  selector: '#login-button',
  element: {
    tagName: 'BUTTON',
    text: 'Login'
  }
};

// Expected AI suggestions:
// - Visual: Button should be visible
// - Text: Button should contain "Login"
// - State: Button should be enabled
// - Navigation: Should redirect after click
```

### 3. Parameter Detection

Test automatic parameterization:

```javascript
// Actions with parameterizable values
const actions = [
  {
    type: 'input',
    selector: '#email',
    text: 'test@example.com'  // Should detect email pattern
  },
  {
    type: 'input', 
    selector: '#phone',
    text: '+1-555-123-4567'   // Should detect phone pattern
  },
  {
    type: 'input',
    selector: '#date',
    text: '2024-01-15'        // Should detect date pattern
  }
];

// Expected parameters:
// - emailAddress: 'test@example.com' (email pattern)
// - phoneNumber: '+1-555-123-4567' (phone pattern)  
// - selectedDate: '2024-01-15' (date pattern)
```

### 4. Cloud Testing Integration

Test multi-provider support:

```javascript
// Test local fallback
const localConfig = {
  cloudProvider: 'local'
};

// Test BrowserStack integration (will fallback to local in test)
const browserstackConfig = {
  cloudProvider: 'browserstack',
  cloudCredentials: {
    browserstack: {
      username: 'test-user',
      accessKey: 'test-key'
    }
  }
};
```

### 5. Performance Monitoring

Test metrics collection:

```javascript
const config = {
  performance: {
    collectMetrics: true,
    thresholds: {
      loadTime: 3000,
      firstContentfulPaint: 1500,
      largestContentfulPaint: 2500
    }
  }
};

// Expected metrics:
// - loadTime: Time from navigation start to load complete
// - firstContentfulPaint: Time to first content render
// - domContentLoaded: Time to DOM ready
```

### 6. Visual Regression Testing

Test baseline capture:

```javascript
const config = {
  visualTesting: {
    enableBaselines: true,
    threshold: 0.1,
    ignoreRegions: [
      { x: 0, y: 0, width: 100, height: 50 }  // Ignore dynamic header
    ]
  }
};

// Expected behavior:
// - Screenshot captured at key moments
// - Baseline stored for comparison
// - Ignore regions excluded from comparison
```

## 🔧 Development Testing

### Testing New Features

When adding new features to the enhanced recording service:

1. **Add Unit Tests**: Create tests in `__tests__/services/`
2. **Update Integration Test**: Add scenarios to `test-enhanced-recording.ts`
3. **Test Error Handling**: Ensure graceful degradation when services fail
4. **Test Performance**: Verify features don't impact recording performance

### Mock Services for Testing

The enhanced services use these external dependencies that are mocked in tests:

- **AIService**: Mocked to return predictable AI responses
- **Puppeteer**: Mocked browser automation
- **Cloud Providers**: Mocked to test integration without real accounts

### Environment Variables for Testing

Set these environment variables for full integration testing:

```bash
# AI Service (optional - will use mocks if not set)
OPENAI_API_KEY=your-openai-key
HUGGINGFACE_API_KEY=your-hf-key

# Cloud Testing (optional - will fallback to local)
BROWSERSTACK_USERNAME=your-username
BROWSERSTACK_ACCESS_KEY=your-access-key

SAUCELABS_USERNAME=your-username  
SAUCELABS_ACCESS_KEY=your-access-key

LAMBDATEST_USERNAME=your-username
LAMBDATEST_ACCESS_KEY=your-access-key
```

## 📊 Expected Test Results

### Successful Test Output

```
🚀 Testing Enhanced WebRecordingService...

📝 Test 1: Starting enhanced recording with AI features...
✅ Recording started successfully!
   Session ID: test-session-1234567890
   Cloud Provider: local
   AI Features: {"smartSelectors":true,"assertionSuggestions":true}

📝 Test 2: Simulating recorded actions...
✅ Added 3 mock actions to session

📝 Test 3: Testing smart selector generation...
✅ Smart selector generated:
   Primary: #submit-btn
   Fallbacks: [data-testid="submit-button"], .btn.btn-success
   Confidence: 0.95
   Strategy: id

📝 Test 4: Testing AI assertion generation...
✅ Generated 3 AI assertions:
   1. visual: #submit-btn
      Expected: "visible"
      Confidence: 0.9
      Reasoning: Button should be visible after form interaction

📝 Test 5: Testing parameter detection...
✅ Detected 2 parameters:
   1. emailAddress: test@example.com
      Type: input
      Confidence: 0.9
      Pattern: email

🎉 All tests completed successfully!
```

### Common Issues and Solutions

1. **TypeScript Errors**: The codebase has some existing TS issues. Focus on testing the new enhanced features.

2. **Missing Dependencies**: Some AI and cloud services may not be available in test environment - this is expected and handled gracefully.

3. **Browser Launch Failures**: Puppeteer may fail in some environments - the service falls back gracefully.

4. **Network Issues**: Cloud provider connections may fail - the service automatically falls back to local execution.

## 🎯 Testing Checklist

- [ ] Enhanced recording starts successfully
- [ ] Smart selectors generate multiple strategies  
- [ ] AI assertions provide meaningful suggestions
- [ ] Parameters are detected from form inputs
- [ ] Performance metrics are collected
- [ ] Visual baselines are captured
- [ ] Session analytics provide insights
- [ ] Export includes all enhanced data
- [ ] Error handling works gracefully
- [ ] Events are emitted correctly

## 🚀 Next Steps

After testing the enhanced WebRecordingService:

1. **Test in Real Browser**: Use actual websites to test selector generation
2. **Test Cloud Providers**: Set up real cloud testing accounts
3. **Test AI Services**: Configure OpenAI/HuggingFace for real AI features
4. **Performance Testing**: Test with large recording sessions
5. **Integration Testing**: Test with the full application stack

The enhanced WebRecordingService provides a solid foundation for enterprise-grade test recording with AI-powered features, multi-cloud support, and intelligent automation.
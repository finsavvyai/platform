# 🌐 Browser Testing Guide for Enterprise Testing System

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
cd backend
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in your environment).

### 2. Test API Endpoints

Once the server is running, you can test the recording functionality using these methods:

## 📡 **API Testing Methods**

### **Method 1: Using curl Commands**

#### Start a Web Recording Session
```bash
curl -X POST http://localhost:3000/api/recording/web/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "browser": "chrome",
    "url": "https://example.com",
    "viewport": {
      "width": 1920,
      "height": 1080
    },
    "aiFeatures": {
      "smartSelectors": true,
      "assertionSuggestions": true,
      "elementHealing": true
    },
    "cloudProvider": "browserstack",
    "cloudCredentials": {
      "browserstack": {
        "username": "your_username",
        "accessKey": "your_access_key"
      }
    }
  }'
```

#### Get Recording Session Status
```bash
curl -X GET http://localhost:3000/api/recording/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Stop Recording Session
```bash
curl -X POST http://localhost:3000/api/recording/web/SESSION_ID/stop \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Method 2: Using Postman**

1. **Import Collection**: Create a new Postman collection
2. **Set Base URL**: `http://localhost:3000`
3. **Add Authentication**: Set up JWT token in headers
4. **Test Endpoints**:
   - `POST /api/recording/web/start` - Start recording
   - `GET /api/recording/sessions/:id` - Get session info
   - `POST /api/recording/web/:id/stop` - Stop recording
   - `GET /api/recording/sessions` - List all sessions

### **Method 3: Browser Developer Tools**

Open your browser's developer console and run:

```javascript
// Start a web recording session
fetch('http://localhost:3000/api/recording/web/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    browser: 'chrome',
    url: 'https://example.com',
    viewport: { width: 1920, height: 1080 },
    aiFeatures: {
      smartSelectors: true,
      assertionSuggestions: true
    }
  })
})
.then(response => response.json())
.then(data => console.log('Recording started:', data))
.catch(error => console.error('Error:', error));
```

## 🎯 **Testing Scenarios**

### **Scenario 1: Basic Web Recording**
```json
{
  "browser": "chrome",
  "url": "https://example.com",
  "viewport": { "width": 1280, "height": 720 }
}
```

### **Scenario 2: Enhanced AI Recording**
```json
{
  "browser": "firefox",
  "url": "https://demo.testim.io",
  "aiFeatures": {
    "smartSelectors": true,
    "assertionSuggestions": true,
    "elementHealing": true,
    "parameterDetection": true
  },
  "visualTesting": {
    "enableBaselines": true,
    "threshold": 0.1
  }
}
```

### **Scenario 3: Cloud Provider Testing**
```json
{
  "browser": "chrome",
  "url": "https://the-internet.herokuapp.com",
  "cloudProvider": "browserstack",
  "cloudCredentials": {
    "browserstack": {
      "username": "your_bs_username",
      "accessKey": "your_bs_key",
      "project": "Browser Testing",
      "build": "Test Build 1.0"
    }
  }
}
```

### **Scenario 4: Performance Monitoring**
```json
{
  "browser": "chrome",
  "url": "https://web.dev",
  "performance": {
    "collectMetrics": true,
    "thresholds": {
      "loadTime": 3000,
      "firstContentfulPaint": 1500,
      "largestContentfulPaint": 2500
    }
  }
}
```

## 🔧 **Frontend Testing Interface**

### **Method 4: Create a Simple HTML Test Page**

Create a test HTML file to interact with your API:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enterprise Testing System - Browser Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 10px 0; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
        button:hover { background: #005a87; }
        .result { background: white; padding: 15px; border-radius: 4px; margin: 10px 0; border-left: 4px solid #007cba; }
        input, select { padding: 8px; margin: 5px; border: 1px solid #ddd; border-radius: 4px; }
        .error { border-left-color: #e74c3c; background: #fdf2f2; }
        .success { border-left-color: #27ae60; background: #f2fdf2; }
    </style>
</head>
<body>
    <h1>🌐 Enterprise Testing System - Browser Test</h1>
    
    <div class="container">
        <h2>Web Recording Test</h2>
        <div>
            <label>Target URL:</label>
            <input type="url" id="targetUrl" value="https://example.com" style="width: 300px;">
        </div>
        <div>
            <label>Browser:</label>
            <select id="browser">
                <option value="chrome">Chrome</option>
                <option value="firefox">Firefox</option>
                <option value="safari">Safari</option>
                <option value="edge">Edge</option>
            </select>
        </div>
        <div>
            <label>Cloud Provider:</label>
            <select id="cloudProvider">
                <option value="local">Local</option>
                <option value="browserstack">BrowserStack</option>
                <option value="saucelabs">SauceLabs</option>
                <option value="lambdatest">LambdaTest</option>
            </select>
        </div>
        <div>
            <button onclick="startRecording()">🎬 Start Recording</button>
            <button onclick="stopRecording()" id="stopBtn" disabled>⏹️ Stop Recording</button>
            <button onclick="getSessionInfo()" id="infoBtn" disabled>ℹ️ Get Session Info</button>
        </div>
    </div>

    <div class="container">
        <h2>Mobile Recording Test</h2>
        <div>
            <label>Platform:</label>
            <select id="mobilePlatform">
                <option value="ios">iOS</option>
                <option value="android">Android</option>
            </select>
        </div>
        <div>
            <label>Device:</label>
            <input type="text" id="deviceName" value="iPhone 14" style="width: 200px;">
        </div>
        <div>
            <label>App ID:</label>
            <input type="text" id="appId" value="com.example.app" style="width: 200px;">
        </div>
        <div>
            <button onclick="startMobileRecording()">📱 Start Mobile Recording</button>
            <button onclick="stopMobileRecording()" id="stopMobileBtn" disabled>⏹️ Stop Mobile Recording</button>
        </div>
    </div>

    <div class="container">
        <h2>API Testing</h2>
        <div>
            <label>API Endpoint:</label>
            <input type="url" id="apiEndpoint" value="https://jsonplaceholder.typicode.com/posts/1" style="width: 400px;">
        </div>
        <div>
            <label>Method:</label>
            <select id="apiMethod">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
            </select>
        </div>
        <div>
            <button onclick="testAPI()">🔗 Test API</button>
        </div>
    </div>

    <div id="results"></div>

    <script>
        const API_BASE = 'http://localhost:3000/api';
        let currentSessionId = null;
        let currentMobileSessionId = null;

        // You'll need to set this to a valid JWT token
        const AUTH_TOKEN = 'your_jwt_token_here';

        function showResult(message, type = 'info') {
            const results = document.getElementById('results');
            const div = document.createElement('div');
            div.className = \`result \${type}\`;
            div.innerHTML = \`<strong>\${new Date().toLocaleTimeString()}</strong>: \${message}\`;
            results.insertBefore(div, results.firstChild);
        }

        async function apiCall(endpoint, options = {}) {
            try {
                const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${AUTH_TOKEN}\`,
                        ...options.headers
                    },
                    ...options
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'API call failed');
                }
                
                return data;
            } catch (error) {
                showResult(\`Error: \${error.message}\`, 'error');
                throw error;
            }
        }

        async function startRecording() {
            const config = {
                browser: document.getElementById('browser').value,
                url: document.getElementById('targetUrl').value,
                viewport: { width: 1920, height: 1080 },
                aiFeatures: {
                    smartSelectors: true,
                    assertionSuggestions: true,
                    elementHealing: true,
                    parameterDetection: true
                },
                visualTesting: {
                    enableBaselines: true,
                    threshold: 0.1
                },
                performance: {
                    collectMetrics: true,
                    thresholds: {
                        loadTime: 3000,
                        firstContentfulPaint: 1500
                    }
                }
            };

            const cloudProvider = document.getElementById('cloudProvider').value;
            if (cloudProvider !== 'local') {
                config.cloudProvider = cloudProvider;
                // Note: You'll need to add actual credentials here
                config.cloudCredentials = {
                    [cloudProvider]: {
                        username: 'your_username',
                        accessKey: 'your_access_key'
                    }
                };
            }

            try {
                const result = await apiCall('/recording/web/start', {
                    method: 'POST',
                    body: JSON.stringify(config)
                });

                currentSessionId = result.sessionId || result.id;
                showResult(\`Web recording started! Session ID: \${currentSessionId}\`, 'success');
                
                document.getElementById('stopBtn').disabled = false;
                document.getElementById('infoBtn').disabled = false;
            } catch (error) {
                showResult(\`Failed to start recording: \${error.message}\`, 'error');
            }
        }

        async function stopRecording() {
            if (!currentSessionId) {
                showResult('No active recording session', 'error');
                return;
            }

            try {
                const result = await apiCall(\`/recording/web/\${currentSessionId}/stop\`, {
                    method: 'POST'
                });

                showResult(\`Recording stopped! Duration: \${result.duration || 'N/A'}ms\`, 'success');
                
                document.getElementById('stopBtn').disabled = true;
                currentSessionId = null;
            } catch (error) {
                showResult(\`Failed to stop recording: \${error.message}\`, 'error');
            }
        }

        async function getSessionInfo() {
            if (!currentSessionId) {
                showResult('No active recording session', 'error');
                return;
            }

            try {
                const result = await apiCall(\`/recording/sessions/\${currentSessionId}\`);
                showResult(\`Session Info: Status=\${result.status}, Actions=\${result.actions?.length || 0}\`, 'info');
            } catch (error) {
                showResult(\`Failed to get session info: \${error.message}\`, 'error');
            }
        }

        async function startMobileRecording() {
            const config = {
                type: 'mobile',
                platform: document.getElementById('mobilePlatform').value,
                metadata: {
                    deviceName: document.getElementById('deviceName').value,
                    appId: document.getElementById('appId').value
                }
            };

            try {
                const result = await apiCall('/recording/mobile/start', {
                    method: 'POST',
                    body: JSON.stringify(config)
                });

                currentMobileSessionId = result.sessionId || result.id;
                showResult(\`Mobile recording started! Session ID: \${currentMobileSessionId}\`, 'success');
                
                document.getElementById('stopMobileBtn').disabled = false;
            } catch (error) {
                showResult(\`Failed to start mobile recording: \${error.message}\`, 'error');
            }
        }

        async function stopMobileRecording() {
            if (!currentMobileSessionId) {
                showResult('No active mobile recording session', 'error');
                return;
            }

            try {
                const result = await apiCall(\`/recording/mobile/\${currentMobileSessionId}/stop\`, {
                    method: 'POST'
                });

                showResult(\`Mobile recording stopped!\`, 'success');
                
                document.getElementById('stopMobileBtn').disabled = true;
                currentMobileSessionId = null;
            } catch (error) {
                showResult(\`Failed to stop mobile recording: \${error.message}\`, 'error');
            }
        }

        async function testAPI() {
            const endpoint = document.getElementById('apiEndpoint').value;
            const method = document.getElementById('apiMethod').value;

            try {
                const response = await fetch(endpoint, { method });
                const data = await response.json();
                
                showResult(\`API Test: \${method} \${endpoint} - Status: \${response.status}\`, 'success');
                showResult(\`Response: \${JSON.stringify(data).substring(0, 200)}...\`, 'info');
            } catch (error) {
                showResult(\`API Test failed: \${error.message}\`, 'error');
            }
        }

        // Show initial message
        showResult('Enterprise Testing System loaded. Configure your JWT token in the script to start testing.', 'info');
    </script>
</body>
</html>
```

Save this as `browser-test.html` and open it in your browser.

## 🎯 **Testing Steps**

### **Step 1: Setup**
1. Start your backend server: `npm run dev`
2. Get a valid JWT token (from login/auth endpoint)
3. Update the `AUTH_TOKEN` in the HTML file

### **Step 2: Test Web Recording**
1. Open the HTML test page
2. Configure target URL and browser
3. Click "Start Recording"
4. Check session info
5. Stop recording

### **Step 3: Test Mobile Recording**
1. Configure platform and device
2. Start mobile recording
3. Monitor session status

### **Step 4: Test API Endpoints**
1. Test various API endpoints
2. Verify response handling

## 🔍 **Monitoring & Debugging**

### **Check Server Logs**
Monitor your backend console for:
- Recording session creation
- Browser/device connections
- Error messages
- Performance metrics

### **Browser Developer Tools**
- **Network Tab**: Monitor API calls
- **Console**: Check for JavaScript errors
- **Application Tab**: Inspect local storage/cookies

### **Database Inspection**
```bash
npm run db:studio
```
This opens Drizzle Studio to inspect your database records.

## 🚀 **Advanced Testing**

### **Load Testing**
Use tools like Artillery or k6 to test multiple concurrent recording sessions.

### **Integration Testing**
Test the full workflow:
1. Start recording → 2. Perform actions → 3. Stop recording → 4. Export test

### **Cloud Provider Testing**
Test with actual cloud provider credentials to verify cloud integration.

## 📝 **Notes**

- Replace `YOUR_JWT_TOKEN` with actual authentication tokens
- Update cloud provider credentials with real values
- Ensure your backend server is running on the correct port
- Check CORS settings if testing from different domains

This comprehensive testing approach will help you validate all aspects of your enterprise testing system in the browser! 🎉
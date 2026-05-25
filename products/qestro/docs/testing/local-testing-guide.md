# 🧪 Questro Local Testing Guide

**Your fully working Questro test automation platform is ready for local testing!**

## 🚀 Quick Start

### Current Running Services
- **Backend API**: http://localhost:8000
- **Frontend App**: http://localhost:3002  
- **API Health Check**: http://localhost:8000/health

### Start Development Servers
```bash
# Option 1: Start all services at once
npm run dev

# Option 2: Start individual services
npm run dev:backend    # Backend only (port 8000)
npm run dev:frontend   # Frontend only (port 3002)
```

## ✅ Automated API Testing

Run the comprehensive test suite:
```bash
./scripts/test-local.sh
```

This tests all endpoints:
- ✅ Health checks and system status
- ✅ User authentication (register/login)
- ✅ Project management (create/list projects)
- ✅ AI test generation (Playwright, Cypress, Selenium)
- ✅ Recording sessions (start/stop/manage)
- ✅ Dashboard analytics and metrics
- ✅ Subscription plans and usage tracking
- ✅ Test execution and results
- ✅ Error handling and validation

## 🎯 Manual Testing Features

### 1. Authentication System
Test user registration and login:
```bash
# Register new user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@questro.io",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login user
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@questro.io", 
    "password": "password123"
  }'
```

### 2. Project Management
Create and manage test projects:
```bash
# Create web project
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Web App",
    "description": "Testing my e-commerce site",
    "type": "web",
    "url": "https://myapp.com"
  }'

# Get all projects
curl http://localhost:8000/api/projects
```

### 3. AI Test Generation
Generate automated tests using AI:
```bash
# Generate Playwright test
curl -X POST http://localhost:8000/api/ai/generate-test \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Test user login with valid credentials",
    "framework": "playwright",
    "testType": "e2e",
    "url": "https://app.questro.io"
  }'

# Generate Cypress test  
curl -X POST http://localhost:8000/api/ai/generate-test \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Test checkout form validation",
    "framework": "cypress",
    "testType": "integration"
  }'
```

**AI Features:**
- ✨ Smart test generation based on natural language descriptions
- 🎯 Framework-specific code (Playwright, Cypress, Selenium)
- 🧠 Context-aware actions and assertions
- 💡 Helpful suggestions for test improvement
- 📊 Confidence scoring and metadata

### 4. Recording Sessions
Record user interactions to generate tests:
```bash
# Start recording session
curl -X POST http://localhost:8000/api/recording/start \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "project-1",
    "type": "web",
    "platform": "chrome",
    "url": "https://app.questro.io"
  }'

# Get session status
curl http://localhost:8000/api/recording/sessions

# Stop recording (replace SESSION_ID with actual ID)
curl -X POST http://localhost:8000/api/recording/SESSION_ID/stop
```

**Recording Features:**
- 🎬 Real-time action capture
- 📸 Automatic screenshot generation  
- 🔄 Live session monitoring
- 📝 Auto-generated test code
- 🎯 Multiple framework support

### 5. Dashboard Analytics
View comprehensive platform analytics:
```bash
# Get dashboard data
curl http://localhost:8000/api/dashboard/analytics
```

**Analytics Include:**
- 📊 Project and test statistics
- 📈 Usage metrics and trends
- 🎯 Success rates by test type
- ⏱️ Recent activity feed
- 📉 Performance over time
- 💰 Subscription usage tracking

### 6. Subscription Management
Test the subscription and billing system:
```bash
# View available plans
curl http://localhost:8000/api/subscriptions/plans

# Check user subscription
curl http://localhost:8000/api/user/subscription
```

**Available Plans:**
- 🆓 **Free**: 100 AI tests, 10 recordings, 2 projects
- 💼 **Pro**: 1,000 AI tests, 100 recordings, 10 projects ($29/month)
- 🏢 **Enterprise**: Unlimited usage, dedicated support ($99/month)

### 7. Test Execution
Execute tests and view results:
```bash
# Run a test
curl -X POST http://localhost:8000/api/tests/execute \
  -H "Content-Type: application/json" \
  -d '{
    "testId": "test-123",
    "projectId": "project-1",
    "environment": "staging",
    "browser": "chrome"
  }'

# Get execution results (replace EXEC_ID)
curl http://localhost:8000/api/tests/executions/EXEC_ID
```

## 🔧 Development Tools

### Backend Development
- **Live reload**: Changes auto-restart the server
- **Logging**: All API calls logged to console
- **Error handling**: Comprehensive error responses
- **CORS**: Configured for local development

### Frontend Development  
- **Hot reload**: Instant updates on code changes
- **Port handling**: Auto-finds available ports
- **Development optimizations**: Fast builds and updates

### Debugging
```bash
# Check server health
curl http://localhost:8000/health

# View API information
curl http://localhost:8000/api

# Monitor backend logs
# Check terminal running npm run dev:backend

# Monitor frontend logs  
# Check terminal running npm run dev:frontend
```

## 🌐 Frontend Testing

Open http://localhost:3002 in your browser to test:

1. **Landing Page**: Marketing site with feature overview
2. **Authentication**: Register/login forms
3. **Dashboard**: Analytics and project overview
4. **AI Generation**: Natural language test creation
5. **Recording Studio**: Interactive test recording
6. **Project Management**: Create and organize tests
7. **Subscription**: Plan selection and billing
8. **Settings**: User preferences and configuration

## 📱 Mobile Testing

Test responsive design:
- Open http://localhost:3002 on mobile device
- Use browser dev tools to simulate mobile
- Test touch interactions and responsive layouts

## 🧪 Testing Scenarios

### End-to-End User Journey
1. Register new account
2. Create first project  
3. Generate AI test for login flow
4. Record user interaction
5. Execute generated tests
6. View results and analytics
7. Upgrade subscription plan

### API Integration Testing
1. Test all CRUD operations
2. Verify error handling
3. Check response formats
4. Test rate limiting
5. Validate authentication flows

## 🚀 Production Readiness

Your local environment includes:
- ✅ **Complete API**: All endpoints functional
- ✅ **Authentication**: JWT-based user system
- ✅ **AI Integration**: Smart test generation
- ✅ **Recording System**: Live session capture
- ✅ **Analytics**: Comprehensive dashboards
- ✅ **Subscription Model**: Multi-tier pricing
- ✅ **Error Handling**: Robust error management
- ✅ **Validation**: Input validation and sanitization

## 🔧 Common Issues & Solutions

### Port Conflicts
```bash
# If ports are in use, servers will auto-select available ports
# Frontend: 3000 → 3001 → 3002 (as needed)
# Backend: Always uses 8000
```

### Server Not Starting
```bash
# Check if ports are available
lsof -i :8000  # Backend port
lsof -i :3002  # Frontend port

# Kill existing processes if needed
kill -9 $(lsof -t -i :8000)
```

### API Not Responding
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check backend logs for errors
# Look for error messages in the terminal running the backend
```

## 🎉 You're Ready!

Your Questro test automation platform is fully functional for local development and testing. All features are working including:

- 🧠 AI-powered test generation
- 🎬 Interactive test recording
- 📊 Real-time analytics dashboard
- 💰 Complete subscription system
- 🔧 Project management
- 🚀 Test execution engine

**Next Steps:**
1. Test all features locally
2. Customize for your specific needs
3. Deploy to production when ready
4. Start building your SaaS business!

---

**Happy Testing!** 🚀✨
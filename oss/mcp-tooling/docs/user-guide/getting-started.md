# Getting Started with MCPOverflow

Welcome to MCPOverflow! This guide will help you get up and running quickly with our AI-powered platform for generating MCP connectors from OpenAPI specifications.

## 🎯 What You'll Learn

- How to create an account and sign in
- Understanding the MCPOverflow dashboard
- Your first connector generation
- Basic configuration and deployment options

## 📋 Prerequisites

Before you begin, make sure you have:

- ✅ A valid email address for account registration
- ✅ An OpenAPI specification file (JSON or YAML) or URL
- ✅ Basic understanding of REST APIs and authentication
- ✅ Modern web browser (Chrome, Firefox, Safari, Edge)

## 🚀 Quick Start (5 Minutes)

### Step 1: Create Your Account

1. **Visit the Sign Up Page**
   - Navigate to [app.mcpoverflow.com/register](https://app.mcpoverflow.com/register)
   - Enter your email address and choose a strong password

2. **Verify Your Email**
   - Check your inbox for a verification email
   - Click the verification link to activate your account
   - If you don't see the email, check your spam folder

3. **Sign In**
   - Return to the sign-in page
   - Enter your credentials to access your dashboard

### Step 2: Prepare Your OpenAPI Specification

You have two options for providing your OpenAPI specification:

**Option A: Upload a File**

- Supported formats: JSON (.json) or YAML (.yml, .yaml)
- Maximum file size: 5MB
- Must be a valid OpenAPI 3.x specification

**Option B: Provide a URL**

- Must be publicly accessible
- Should return valid OpenAPI specification
- HTTPS URLs are preferred for security

### Step 3: Generate Your First Connector

1. **Navigate to Generator**
   - From your dashboard, click "Generate New Connector"
   - Or directly visit the [Generate page](https://app.mcpoverflow.com/generate)

2. **Upload or Link Your Specification**
   - Click "Choose File" to upload a local file
   - Or paste your specification URL in the URL field
   - Click "Validate Specification" to check compatibility

3. **Configure Your Connector**
   - **Connector Name**: Choose a descriptive name (e.g., "E-commerce API Connector")
   - **Target Runtime**: Select your preferred runtime:
     - **TypeScript Worker**: For Node.js/TypeScript environments
     - **Go Worker**: For Go runtime environments
     - **Download Only**: Just generate code without deployment
   - **Authentication**: The system will auto-detect the authentication scheme
   - **Filter Endpoints**: Optionally exclude specific endpoints

4. **Generate and Download**
   - Click "Generate Connector" to start the process
   - Wait for the generation to complete (usually 30-60 seconds)
   - Download your connector package when ready

### Step 4: Use Your Connector

Your generated package includes:

```
mcp-connector/
├── worker.ts          # Main worker code
├── package.json       # Dependencies and scripts
├── README.md          # Usage instructions
├── manifest.json      # MCP configuration
└── dist/              # Compiled output
```

## 🎛️ Understanding Your Dashboard

### Navigation Menu

- **🏠 Dashboard**: Overview of your connectors and activity
- **⚡ Generate**: Create new connectors
- **📊 Connectors**: Manage and view your existing connectors
- **⚙️ Settings**: Account and preference management

### Dashboard Metrics

Your dashboard shows:

- **Total Connectors**: Number of connectors you've created
- **Active Connectors**: Currently deployed and functional connectors
- **Total Requests**: API calls made through your connectors
- **Recent Activity**: Latest generation jobs and updates

## 🔧 Connector Configuration

### Authentication Modes

MCPOverflow automatically detects and configures these authentication schemes:

#### API Key Authentication

```json
{
  "auth_mode": "api_key",
  "config": {
    "header_name": "X-API-Key",
    "key_param": "api_key"
  }
}
```

#### OAuth 2.0 Client Credentials

```json
{
  "auth_mode": "oauth_client",
  "config": {
    "token_url": "https://api.example.com/oauth/token",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }
}
```

#### JWT Bearer Token

```json
{
  "auth_mode": "jwt",
  "config": {
    "token_header": "Authorization",
    "token_prefix": "Bearer"
  }
}
```

### Runtime Options

#### TypeScript Worker

- **Best for**: Node.js environments, TypeScript projects
- **Includes**: Type definitions, error handling, CORS support
- **Size**: ~2MB bundled
- **Performance**: Fast startup, low memory usage

#### Go Worker

- **Best for**: High-performance, Go environments
- **Includes**: Compiled binary, minimal dependencies
- **Size**: ~10MB compiled
- **Performance**: Excellent throughput, low latency

#### Download Only

- **Best for**: Custom deployment, learning purposes
- **Includes**: Source code, build scripts, documentation
- **Customization**: Full control over deployment

## 📚 Next Steps

Now that you've created your first connector, explore these guides:

- [Connector Management](./connector-management.md) - Learn to manage and monitor your connectors
- [Advanced Configuration](./advanced-configuration.md) - Customize authentication and deployment
- [Troubleshooting](./troubleshooting.md) - Solve common issues
- [Use Cases](./use-cases.md) - See real-world examples

## 🆘 Need Help?

### Common Issues

**Specification Validation Failed**

- Ensure your file is valid JSON/YAML
- Check OpenAPI version compatibility (3.x)
- Verify all required fields are present

**Generation Failed**

- Check specification for complex authentication
- Try filtering endpoints to reduce complexity
- Contact support if issues persist

**Download Problems**

- Check your browser download settings
- Try a different browser
- Ensure stable internet connection

### Get Support

- **📖 Documentation**: Browse comprehensive guides
- **🐛 Report Issues**: [GitHub Issues](https://github.com/mcpoverflow/mcpoverflow/issues)
- **💬 Community**: [GitHub Discussions](https://github.com/mcpoverflow/mcpoverflow/discussions)
- **📧 Email**: support@mcpoverflow.com

### Tips for Success

1. **Start Simple**: Begin with a small, well-documented API specification
2. **Test Locally**: Use the "Download Only" option for initial testing
3. **Monitor Usage**: Check your dashboard for performance metrics
4. **Iterate**: Refine your specifications based on generation results
5. **Secure Keys**: Never share your API keys or authentication credentials

---

Ready to dive deeper? Check out our [Connector Management Guide](./connector-management.md) to learn how to monitor and maintain your connectors.

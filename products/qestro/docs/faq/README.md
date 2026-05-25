# Questro FAQ - Frequently Asked Questions

Find quick answers to common questions about Questro AI-Powered Testing Platform. Can't find what you're looking for? [Ask our community](https://discord.gg/questro) or [contact support](mailto:support@questro.io).

## 🚀 Getting Started

### Installation & Setup

**Q: What are the system requirements for Questro?**
- **Operating System**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **Node.js**: Version 18.0.0 or higher
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: 2GB free space
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

**Q: How do I install Questro?**
1. Visit [questro.io/download](https://questro.io/download)
2. Download the appropriate installer for your OS
3. Run the installer and follow the setup wizard
4. Launch Questro and sign up or log in

For detailed instructions, see our [Installation Guide](../getting-started/installation.md).

**Q: Can I use Questro without installing anything?**
Yes! Try our [web-based version](https://try.questro.io) for basic testing functionality.

**Q: How do I update Questro?**
Questro automatically checks for updates. You can also:
- **Desktop App**: Help → Check for Updates
- **CLI**: `questro update`
- **Browser Extension**: Updates through your browser's extension store

### Account & Pricing

**Q: Is Questro free?**
Questro offers a free tier with:
- Up to 3 projects
- 100 test runs per month
- Basic web testing
- Community support

Paid plans start at $29/month for professional features.

**Q: What's included in each plan?**
- **Free**: Basic web testing, 100 runs/month, community support
- **Professional**: All features, 1000 runs/month, email support
- **Team**: Everything in Pro + team collaboration, 5000 runs/month
- **Enterprise**: Custom limits, priority support, advanced security

See our [pricing page](https://questro.io/pricing) for details.

**Q: Can I cancel my subscription anytime?**
Yes! You can cancel your subscription at any time. You'll continue to have access until the end of your billing period.

## 🎯 Testing & Features

### Test Creation

**Q: How do I create my first test?**
1. Open Questro and create a new project
2. Click "Start Recording" or use `Ctrl+Shift+R`
3. Perform the actions you want to test in your browser
4. Click "Stop Recording" when done
5. Review and save your test

Step-by-step guide: [Your First Test](../tutorials/first-test.md)

**Q: What types of tests can I create?**
- **Web Application Tests**: Test websites and web apps
- **Mobile App Tests**: Test iOS and Android applications
- **API Tests**: Test REST and GraphQL APIs
- **Database Tests**: Validate database operations
- **Security Tests**: Find vulnerabilities
- **Performance Tests**: Measure application performance

**Q: How does AI test generation work?**
1. Write a natural language description of what you want to test
2. Questro's AI analyzes your application structure
3. Generates test steps automatically
4. Review and customize the generated test

Example: "Test the login functionality with valid and invalid credentials"

**Q: Can I edit recorded tests?**
Yes! You can:
- Add, remove, or modify test steps
- Change selectors and timeouts
- Add assertions and validations
- Insert custom JavaScript code
- Add data-driven testing

### Supported Technologies

**Q: What web frameworks does Questro support?**
- **Frontend**: React, Vue, Angular, Svelte, jQuery, Vanilla JS
- **Backend**: Node.js, Python, Ruby, PHP, Java, .NET
- **Databases**: PostgreSQL, MySQL, MongoDB, Redis, SQLite
- **APIs**: REST, GraphQL, SOAP
- **Authentication**: OAuth, JWT, Basic Auth, SAML

**Q: Does Questro work with Single Page Applications (SPAs)?**
Yes! Questro automatically detects and handles:
- React Router, Vue Router, Angular Router
- AJAX requests and dynamic content
- Client-side rendering
- State management (Redux, Vuex, NgRx)

**Q: Can I test mobile web applications?**
Yes! Questro can test mobile web apps using:
- Device emulation in Chrome DevTools
- Responsive design testing
- Touch gesture simulation
- Mobile-specific user agents

### Mobile Testing

**Q: How do I set up mobile testing?**
1. Install Questro mobile app (iOS/Android)
2. Enable Developer Options on your device
3. Connect device via USB (for Android) or WiFi
4. Install Questro device agent
5. Start recording from Questro desktop app

Detailed setup: [Mobile Testing Guide](../user-guide/mobile-testing.md)

**Q: What mobile platforms are supported?**
- **iOS**: iPhone, iPad (iOS 13+)
- **Android**: All major manufacturers (Android 7+)
- **Hybrid Apps**: React Native, Flutter, Cordova, Ionic
- **Web Apps**: Mobile web testing via device emulation

**Q: Do I need physical devices for testing?**
No! Questro supports:
- **Physical Devices**: Real device testing
- **Emulators**: iOS Simulator, Android Emulator
- **Cloud Devices**: BrowserStack, Sauce Labs integration
- **Device Farms**: AWS Device Farm integration

## 🔧 Technical Questions

### Performance & Limitations

**Q: How many tests can I run in parallel?**
- **Free Plan**: 1 parallel test
- **Professional**: 5 parallel tests
- **Team**: 15 parallel tests
- **Enterprise**: Unlimited (with proper infrastructure)

**Q: What are the performance limits?**
- **Test Recording**: Unlimited
- **Test Execution**: Based on your plan
- **Test Duration**: Up to 30 minutes per test
- **File Uploads**: Up to 100MB per test
- **API Calls**: 1000 calls per test (adjustable)

**Q: How does Questro handle dynamic content?**
Questro includes smart selectors and wait strategies:
- **Smart Selectors**: AI-powered element identification
- **Dynamic Waits**: Automatic wait for elements
- **Retry Logic**: Automatic retry on failures
- **Content Matching**: Multiple selector strategies

### Integration & API

**Q: Can I integrate Questro with CI/CD pipelines?**
Yes! Questro supports:
- **GitHub Actions**: Pre-built workflows available
- **Jenkins**: Plugin and CLI integration
- **GitLab CI**: YAML configuration templates
- **CircleCI**: Orb and configuration examples
- **Custom Webhooks**: Trigger tests from any system

**Q: Does Questro have an API?**
Yes! Questro provides:
- **REST API**: Full CRUD operations for projects and tests
- **GraphQL API**: Efficient data queries
- **Webhooks**: Real-time test status updates
- **SDKs**: JavaScript, Python, Java libraries

Documentation: [API Reference](../api/)

**Q: Can I export test results?**
Questro supports multiple export formats:
- **JSON**: Machine-readable results
- **XML**: JUnit-compatible format
- **HTML**: Visual reports
- **PDF**: Shareable reports
- **CSV**: Data analysis spreadsheets

## 🛠️ Troubleshooting

### Common Issues

**Q: Questro can't find elements on my page**
Try these solutions:
1. **Wait Strategy**: Add explicit waits for dynamic content
2. **Selector Strategy**: Use different selectors (CSS, XPath, text)
3. **Frame Handling**: Check if the element is in an iframe
4. **Shadow DOM**: Use special selectors for shadow DOM elements
5. **AI Mode**: Enable AI-powered element detection

**Q: Tests are running too slowly**
Optimize your tests:
1. **Reduce Waits**: Use specific waits instead of fixed delays
2. **Parallel Execution**: Run tests in parallel (if supported)
3. **Test Organization**: Group related tests together
4. **Environment**: Use faster testing environments
5. **Network**: Test on faster network connections

**Q: Tests fail randomly**
Common causes and solutions:
1. **Race Conditions**: Add proper waits and retries
2. **Timing Issues**: Increase timeout values
3. **Environment Instability**: Check test environment stability
4. **Data Dependencies**: Ensure test data is consistent
5. **Browser Issues**: Try different browser versions

### Browser & Extension Issues

**Q: Questro browser extension not working**
Try these steps:
1. **Update Extension**: Check for updates in extension store
2. **Browser Restart**: Restart your browser completely
3. **Extension Permissions**: Ensure proper permissions are granted
4. **Site Access**: Enable extension on your test sites
5. **Clear Cache**: Clear browser cache and cookies

**Q: VSCode extension commands not working**
Troubleshooting steps:
1. **Reload VSCode**: Use `Developer: Reload Window` command
2. **Check Extension**: Ensure Questro extension is enabled
3. **Update Extension**: Check for extension updates
4. **Workspace Trust**: Ensure workspace is trusted
5. **Conflict Check**: Disable conflicting extensions

## 🔒 Security & Privacy

### Data Security

**Q: Is my test data secure?**
Yes! Questro implements:
- **End-to-End Encryption**: All data encrypted in transit and at rest
- **Secure Storage**: Encrypted database storage
- **Access Control**: Role-based permissions
- **Audit Logs**: Complete activity tracking
- **Compliance**: GDPR, SOC 2 Type II certified

**Q: Does Questro store my application data?**
No! Questro only stores:
- **Test Definitions**: Your test scripts and configurations
- **Test Results**: Execution results and screenshots
- **User Data**: Account information and preferences
- **Analytics**: Anonymous usage statistics

**Q: Can Questro test secure applications?**
Yes! Questro supports:
- **HTTPS Testing**: Certificate validation bypass options
- **Authentication**: OAuth, JWT, Basic Auth, SAML
- **VPN/Proxy**: Network configuration support
- **Corporate Networks**: Enterprise firewall compatibility
- **Self-Signed Certificates**: Custom certificate handling

## 📱 Mobile & Extensions

### VSCode Extension

**Q: What features does the VSCode extension provide?**
- **In-Editor Testing**: Run tests without leaving VSCode
- **Syntax Highlighting**: Questro test file highlighting
- **IntelliSense**: Auto-completion for Questro commands
- **Debugging**: Step-through test debugging
- **Git Integration**: Version control for tests
- **Live Preview**: See test results in VSCode

**Q: How do I use voice commands in VSCode?**
1. Install Questro VSCode extension
2. Enable voice commands in settings
3. Use `Ctrl+Shift+V` to start/stop voice
4. Say commands like "Create test for login form"

### Browser Extension

**Q: What browsers are supported?**
- **Chrome**: Version 90+ (Recommended)
- **Firefox**: Version 88+
- **Edge**: Version 90+
- **Safari**: Version 14+ (Limited features)

**Q: Can I record tests without installing Questro?**
Yes! Install our browser extension:
1. Install from Chrome Web Store or Firefox Add-ons
2. Enable extension permissions
3. Start recording directly from your browser
4. Sync tests with your Questro account

## 💼 Enterprise & Teams

### Team Collaboration

**Q: How does team collaboration work?**
Teams can:
- **Shared Projects**: Collaborate on the same test projects
- **Role-Based Access**: Different permissions for different roles
- **Review Process**: Peer review for test changes
- **Comments**: Discuss tests directly in the interface
- **Activity Tracking**: See who changed what and when

**Q: Can I have multiple environments?**
Yes! Questro supports:
- **Environment Variables**: Different configs per environment
- **Test Data**: Separate data for staging/production
- **Database Connections**: Multiple database configurations
- **API Endpoints**: Different URLs per environment
- **Deployment**: CI/CD integration for each environment

### Enterprise Features

**Q: What enterprise features are available?**
- **Single Sign-On (SSO)**: SAML, OAuth, LDAP integration
- **Advanced Security**: IP whitelisting, audit logs
- **Custom Integrations**: API access and webhooks
- **Dedicated Support**: Priority technical support
- **SLA Guarantee**: 99.9% uptime guarantee
- **Custom Training**: On-site training sessions

**Q: Can Questro be self-hosted?**
Yes! Enterprise plans include:
- **On-Premises Deployment**: Install on your own servers
- **Private Cloud**: AWS, Azure, GCP deployment
- **Container Support**: Docker and Kubernetes
- **Source Code Access**: Full source code availability
- **Custom Development**: Feature development services

## 🆘 Support & Resources

### Getting Help

**Q: How can I get support?**
Multiple support channels available:
- **Documentation**: Comprehensive guides and tutorials
- **Community**: Discord community and GitHub discussions
- **Email Support**: support@questro.io (response within 24 hours)
- **Priority Support**: Available for paid plans
- **Enterprise Support**: Dedicated account manager

**Q: Where can I find video tutorials?**
- **YouTube Channel**: [youtube.com/c/questro](https://youtube.com/c/questro)
- **Video Library**: [questro.io/tutorials](https://questro.io/tutorials)
- **Live Webinars**: Weekly training sessions
- **On-Demand Courses**: Self-paced learning platform

### Feature Requests

**Q: How do I request new features?**
We love hearing from you!
1. **GitHub Issues**: Create feature request tickets
2. **Community Forum**: Discuss with other users
3. **Feedback Form**: In-app feedback submission
4. **Email**: features@questro.io
5. **User Interviews**: Participate in product development

**Q: Can I contribute to Questro?**
Absolutely! We welcome contributions:
- **Open Source**: Core platform is open source
- **Documentation**: Help improve our docs
- **Bug Reports**: Report and help fix issues
- **Feature Development**: Contribute new features
- **Community**: Help other users in forums

---

**Still have questions?**
- 📧 Email us: [support@questro.io](mailto:support@questro.io)
- 💬 Join Discord: [discord.gg/questro](https://discord.gg/questro)
- 📖 Browse docs: [questro.io/docs](https://questro.io/docs)
- 🎥 Watch tutorials: [youtube.com/c/questro](https://youtube.com/c/questro)
# qestro Platform Architecture

## Overview
qestro is an enterprise-grade AI-powered SaaS testing automation platform with hybrid cloud-agent architecture.

## Domain Strategy
Split domain architecture for optimal user experience:

### qestro.app - Platform & Application 🚀
- **Purpose**: Product delivery, testing platform, user dashboard
- **Features**: Recording studio, AI test generation, analytics, API testing
- **Target Audience**: Registered users, developers, QA teams, enterprises
- **Current Status**: ✅ Live and operational with full platform features
- **Content**: Complete qestro testing automation platform

### qestro.io - Marketing & Documentation 📖
- **Purpose**: Lead generation, product information, technical documentation
- **Features**: Landing pages, pricing tiers, testimonials, API docs
- **Target Audience**: Potential customers, developers evaluating platform
- **Call-to-Action**: Sign up for free trial, view documentation, schedule demo
- **Content**: Marketing site, comprehensive documentation, getting started guides

## Platform Features
When users visit either domain, they get access to:

### Core Testing Capabilities
- **Recording Studio**: AI-powered test recording for mobile and web
- **Test Execution**: Maestro (mobile) + Playwright (web) engines
- **AI Test Generation**: OpenAI integration for intelligent test creation
- **Analytics Dashboard**: Comprehensive test insights and reporting

### Enterprise Features
- **API Management**: RESTful API testing and monitoring
- **Database Testing**: Database validation and testing
- **Voice Testing**: Voice recognition and command testing
- **Scheduling**: Automated test execution with cron jobs
- **Collaboration**: Team-based testing workflows

### Technical Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + PostgreSQL + Redis
- **Real-time**: WebSocket communication with Socket.IO
- **Cloud**: Cloudflare Pages + Render.com
- **Testing**: Maestro (mobile) + Playwright (web)

## Infrastructure Architecture

### Hybrid Cloud-Agent Model
```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│   Cloud Platform│◄──────────────► │   Local Agent   │
│                 │                 │                 │
│ • React UI      │                 │ • Device Control│
│ • API Gateway   │                 │ • Test Engines  │
│ • Database      │                 │ • Real-time Sync│
│ • AI Services   │                 │                 │
└─────────────────┘                 └─────────────────┘
```

### Data Flow
1. **User Interaction**: React frontend captures user actions
2. **API Processing**: Backend processes requests and manages state
3. **Agent Communication**: Real-time WebSocket to local agents
4. **Test Execution**: Agents run tests on actual devices/browsers
5. **Results Sync**: Test results flow back to cloud platform

## Deployment Architecture

### Production Environment
- **qestro.app**: Primary production domain
- **qestro.io**: Secondary production domain (identical setup)
- **Backend**: Render.com (Node.js + PostgreSQL)
- **Frontend**: Cloudflare Pages (static React build)
- **Real-time**: WebSocket connections to backend

### Development Workflow
```
Local Development → Git Push → Auto Deploy → Production
     │                   │              │
┌────▼────┐        ┌─────▼─────┐   ┌────▼────┐
│Frontend │        │   GitHub  │   │Cloudflare│
│+Backend │───push──│  Actions  │───▶│  Pages   │
│(Vite)   │        │           │   │         │
└─────────┘        └───────────┘   └─────────┘
                                         │
                                   ┌─────▼─────┐
                                   │ qestro.app│
                                   │ qestro.io │
                                   └───────────┘
```

## Security & Performance
- **Authentication**: JWT with refresh tokens
- **Data Encryption**: End-to-end encryption for sensitive data
- **Caching**: Redis for session management and performance
- **CDN**: Cloudflare CDN for global content delivery
- **Monitoring**: Real-time health checks and error tracking

## User Experience
Both domains provide identical user experiences:
- Seamless login and authentication
- Full feature access based on subscription
- Real-time test execution and monitoring
- Cross-platform compatibility (mobile + web)
- Enterprise-grade security and reliability

## Future Enhancements
- Additional domains for regional deployment
- Multi-tenant architecture for enterprise clients
- Advanced AI features for test optimization
- Extended device and browser support
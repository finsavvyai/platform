# QueryFlux

**The AI-native database workspace for builders shipping apps with agents.**

QueryFlux is a database workspace for the vibecoding era: connect real databases, understand schemas instantly, ask questions in natural language, generate safe SQL, create backend code from database context, and expose scoped tools to AI coding agents through MCP.

Think of it as Cursor for your database layer. Web is the SaaS control plane, desktop is the secure local/private database bridge, mobile is the production pulse companion, and MCP is the agent interface.

---

## Product Pillars

### Talk To Your Database
- Schema-aware chat and natural-language SQL
- SQL explanation, repair, and optimization
- Safe read-only execution by default
- Result summaries for builders who need fast answers

### Generate The Backend
- REST endpoint generation from tables
- TypeScript types and validation schemas
- Prisma, Drizzle, SQLAlchemy, or GORM model generation
- Migrations, seed data, API docs, and test fixtures

### Ship Safely
- Destructive-query guardrails
- Environment awareness for local, staging, and production
- Query and migration previews
- Approval flows for risky changes
- Human and agent audit logs

### Agent-Ready Data Layer
- MCP tools for schema inspection, SQL generation, read-only queries, and code generation
- Scoped agent permissions by workspace, database, environment, and operation
- Safe database context for Cursor, Claude, Codex, Windsurf, and similar tools

### Cross-Platform Workspace
- **Web**: team SaaS control plane, saved context, generated artifacts, billing, collaboration
- **Desktop**: secure local/private DB access, OS credential storage, SSH tunnels, native packaging
- **Mobile**: alerts, approvals, read-only production checks, incident visibility
- **MCP**: AI-agent database interface

---

## Key Features

### Core Database Management
- **Multi-Database Support**: Connect to PostgreSQL, MySQL, SQLite, MongoDB, and more
- **Visual Schema Explorer**: Interactive database structure visualization
- **Multi-Tab Query Editor**: Work on multiple queries simultaneously with syntax highlighting
- **Query History**: Track and revisit all executed queries with timestamps
- **Saved Queries**: Bookmark and organize frequently used queries
- **Natural Language SQL**: Convert plain English to safe SQL queries

### AI-Powered Builder Features
- **AI Database Engine**: Get intelligent insights, optimization suggestions, and schema recommendations
- **Agent Workflows**: Let approved AI agents inspect schemas, generate SQL, and create backend artifacts
- **Backend Generator**: Generate API routes, types, validation schemas, migrations, seed data, and docs from database context
- **Advanced Voice Assistant**: Control the entire platform using voice commands
  - 7 voice capability categories (Query, Monitoring, Config, Troubleshooting, Planning, Security, Scheduling)
  - Real-time performance monitoring via voice
  - Context-aware conversations
  - Multiple voice options (Male, Female, Robot)
- **Auto API Generator**: Automatically generate REST APIs from database schemas
  - CRUD operations generation
  - Authentication & rate limiting
  - Swagger documentation
  - Versioning support
- **AI-Powered Data Masking**: Intelligent detection and masking of sensitive data
  - PII detection (emails, SSNs, credit cards, phone numbers)
  - Multiple masking strategies (hash, encrypt, tokenize, redact, partial)
  - Compliance support (GDPR, HIPAA, PCI-DSS)

### Code Generation
- **Multi-Language Code Generator**: Generate database models and queries in 15+ languages
  - TypeScript, JavaScript, Python, Java, C#, Go, Rust, PHP, Ruby, Swift, Kotlin
  - Node.js, Django, Spring Boot, Laravel frameworks support
  - ORMs: Prisma, TypeORM, Sequelize, SQLAlchemy, Hibernate, GORM
- **Export Formats**: SQL, JSON, CSV, XML

### 🎨 **Customization & Themes**
- **Custom Theme Builder**: Create and save personalized themes
  - Full color customization (primary, secondary, accent, background, text)
  - Border radius and font family control
  - Real-time preview
- **Pre-built Themes**: Ocean Blue, Sunset Orange, Forest Green, Midnight Purple, Crimson Red, Royal Gold
- **Dark/Light Mode**: System-aware theme switching

### 🌍 **Internationalization**
**Complete translations in 12 languages:**
- English, Spanish, French, German, Italian, Portuguese
- Russian, Chinese (Simplified), Japanese
- Arabic, Hebrew, Hindi
- RTL support for Arabic and Hebrew

### 🔌 **Extension Ecosystem**
- **Plugin Marketplace**: Extend functionality with powerful plugins
  - Data Masking Pro
  - Voice Commands
  - Advanced AI Analytics
  - Custom Themes
  - Schema Diff Tool
  - Performance Profiler
  - Query Optimizer
  - Data Migration Tool
- **Extension Management**: Install, uninstall, enable/disable plugins on the fly

### 📈 **Monitoring & Alerting**
- **Real-Time Performance Dashboard**:
  - CPU usage, memory consumption, active connections
  - Average query time, disk usage
  - Query per second (QPS) metrics
  - Live system health status
- **Alert System**:
  - Configurable thresholds (CPU, memory, query time, error rates)
  - Multiple notification channels (email, SMS, webhook, Slack)
  - Alert history and management
- **Query Scheduling**: Schedule queries and backups with cron expressions

### 👥 **Team Collaboration**
- **Project Management**: Organize databases into projects
- **Team Management**: Invite team members with role-based access control
  - Roles: Owner, Admin, Developer, Viewer
  - Granular permissions (read, write, delete, manage team)
- **Activity Audit Trail**: Track all team actions with timestamps
- **Shared Queries**: Collaborate on queries across the team

### 🐳 **Docker Integration**
- **One-Click Database Deployment**: Deploy PostgreSQL, MySQL, MongoDB, Redis via Docker
- **Container Management**: Start, stop, configure database containers
- **Environment Configuration**: Manage ports, volumes, and environment variables

### 💳 **Subscription Management**
- **Tiered Plans**: Free, Pro, Team, Enterprise
- **Feature Gates**: Control access to premium features
- **Usage Tracking**: Monitor API calls, queries, storage
- **Billing Integration**: Ready for Stripe integration

---

## 🏗️ Architecture

### **Frontend Stack**
- **React 18** with TypeScript
- **Vite** for lightning-fast development
- **Tailwind CSS** for responsive, modern UI
- **Lucide React** for beautiful icons
- **Context API** for state management

### **Backend Stack**
- **QueryFlux Go backend** for auth, workspaces, connections, query execution, saved queries, and audit logs
- **QueryLens API** for natural-language SQL, schema reasoning, and query safety
- **QueryFlux MCP server** for scoped AI-agent database access
- **PostgreSQL** for production persistence

### **Database Schema**
Comprehensive schema with 20+ tables:
- User profiles and authentication
- Database connections and projects
- Queries (history, saved, scheduled)
- Extensions and plugins
- Teams and permissions
- Monitoring and alerts
- API endpoints
- Themes and preferences
- Audit logs

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd queryflux
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run database migrations**

All migrations are in `supabase/migrations/`. Apply them via Supabase dashboard or CLI.

5. **Start development server**
```bash
npm run dev
```

6. **Build for production**
```bash
npm run build
```

7. **Preview production build**
```bash
npm run preview
```

---

## 📋 What Needs to Be Implemented for Full Production

### 🔐 **Authentication & Security**

#### ✅ Completed:
- Supabase authentication integration
- Row Level Security policies on all tables
- User profiles and preferences
- Team-based access control

#### ⚠️ Required:
- [ ] **User Registration & Login UI**: Create sign-up/sign-in forms
- [ ] **Password Reset Flow**: Implement forgot password functionality
- [ ] **Email Verification**: Add email confirmation for new users
- [ ] **OAuth Providers**: Add Google, GitHub, Microsoft login options
- [ ] **Session Management**: Implement auto-logout and session refresh
- [ ] **2FA/MFA**: Add two-factor authentication for enterprise users
- [ ] **API Key Management**: Allow users to generate and manage API keys
- [ ] **Audit Logging**: Complete implementation of security audit logs
- [ ] **Rate Limiting**: Add rate limiting to prevent abuse
- [ ] **CORS Configuration**: Properly configure CORS for production

---

### 🔌 **Database Connections**

#### ✅ Completed:
- Connection form and management UI
- Multiple database type support structure
- Connection state persistence
- Project organization

#### ⚠️ Required:
- [ ] **Actual Database Drivers**: Integrate real database drivers (pg, mysql2, mongodb, etc.)
- [ ] **Connection Pooling**: Implement proper connection pool management
- [ ] **SSH Tunneling**: Add SSH tunnel support for secure connections
- [ ] **SSL/TLS Support**: Implement encrypted database connections
- [ ] **Connection Testing**: Real connection validation before saving
- [ ] **Connection Sharing**: Team-wide connection sharing with permissions
- [ ] **Secret Management**: Secure storage of credentials (consider Vault)
- [ ] **Auto-Reconnect**: Handle connection drops and auto-reconnection

---

### 📝 **Query Execution**

#### ✅ Completed:
- Query editor UI with tabs
- Query history storage
- Saved queries feature

#### ⚠️ Required:
- [ ] **Query Execution Engine**: Backend service to execute queries against real databases
- [ ] **Result Set Display**: Implement data grid with sorting, filtering, pagination
- [ ] **Query Cancellation**: Allow users to cancel long-running queries
- [ ] **Export Results**: Export to CSV, JSON, Excel formats
- [ ] **Query Explain/Analyze**: Show query execution plans
- [ ] **Query Validation**: Syntax checking before execution
- [ ] **Transaction Support**: BEGIN, COMMIT, ROLLBACK handling
- [ ] **Multiple Result Sets**: Handle queries returning multiple result sets
- [ ] **Streaming Large Results**: Stream large datasets efficiently
- [ ] **Query Templates**: Parameterized queries with variable substitution

---

### 🤖 **AI Features**

#### ✅ Completed:
- UI components for all AI features
- Voice assistant interface
- Natural language SQL converter UI
- Auto API generator interface
- Data masking UI

#### ⚠️ Required:
- [ ] **AI Model Integration**: Integrate OpenAI, Claude, or open-source LLMs
- [ ] **Natural Language to SQL**: Implement actual NL→SQL conversion
- [ ] **Voice Recognition**: Integrate Web Speech API or cloud service
- [ ] **Voice Synthesis**: Implement text-to-speech for responses
- [ ] **Context Management**: Maintain conversation context for voice assistant
- [ ] **Schema Context**: Provide database schema to AI for better suggestions
- [ ] **Query Optimization AI**: Real AI-powered query optimization
- [ ] **Data Masking Detection**: ML models for PII detection
- [ ] **Auto API Backend**: Generate and deploy actual API endpoints
- [ ] **AI Cost Management**: Track and limit AI API usage

---

### 📊 **Monitoring & Alerting**

#### ✅ Completed:
- Monitoring dashboard UI
- Alert configuration UI
- Query scheduling UI

#### ⚠️ Required:
- [ ] **Metrics Collection**: Real-time metrics gathering from databases
- [ ] **Time-Series Storage**: Store metrics history (consider TimescaleDB)
- [ ] **Alert Engine**: Background service to evaluate alert conditions
- [ ] **Notification Service**: Email, SMS, Slack, webhook integrations
- [ ] **Query Scheduler**: Cron-based query execution service
- [ ] **Backup Scheduler**: Automated database backup system
- [ ] **Performance Baselines**: Automatic baseline calculation for anomaly detection
- [ ] **Dashboard Charts**: Implement actual chart rendering (consider Chart.js, Recharts)
- [ ] **Log Aggregation**: Centralized logging for all queries and operations

---

### 🔌 **Extension System**

#### ✅ Completed:
- Extension marketplace UI
- Plugin installation/uninstallation UI
- Extension permissions system

#### ⚠️ Required:
- [ ] **Plugin Architecture**: Define plugin API and lifecycle
- [ ] **Sandboxed Execution**: Isolate plugin code execution
- [ ] **Plugin Registry**: Backend registry for plugin metadata
- [ ] **Auto-Updates**: Automatic plugin version updates
- [ ] **Plugin Development Kit**: SDK and documentation for developers
- [ ] **Plugin Testing Framework**: Testing tools for plugin developers
- [ ] **Plugin Monetization**: Payment processing for paid plugins
- [ ] **Plugin Reviews**: Rating and review system

---

### 💻 **Code Generation**

#### ✅ Completed:
- Code generator UI
- Language and framework selection
- Template structure

#### ⚠️ Required:
- [ ] **Schema Introspection**: Read actual database schemas
- [ ] **Code Templates**: Complete templates for all languages/frameworks
- [ ] **Type Mapping**: Database type to language type conversion
- [ ] **Relationship Detection**: Foreign key and relationship mapping
- [ ] **Migration Generator**: Generate migration files from schema changes
- [ ] **ORM Configuration**: Generate ORM config files (Prisma schema, etc.)
- [ ] **API Code Generator**: Complete REST API scaffolding
- [ ] **Documentation Generator**: Auto-generate API documentation

---

### 👥 **Team Collaboration**

#### ✅ Completed:
- Team management UI
- Role-based access control structure
- Project organization

#### ⚠️ Required:
- [ ] **Team Invitations**: Email invitation system
- [ ] **Permission Enforcement**: Backend enforcement of RLS policies
- [ ] **Activity Feed**: Real-time activity notifications
- [ ] **Shared Workspaces**: Team-wide query and connection sharing
- [ ] **Comments & Mentions**: Collaboration on queries
- [ ] **Version Control**: Query versioning and history
- [ ] **Approval Workflows**: Query approval before execution (production safety)
- [ ] **Notification System**: In-app and email notifications

---

### 💳 **Billing & Subscriptions**

#### ✅ Completed:
- Subscription management UI
- Plan comparison
- Usage tracking structure

#### ⚠️ Required:
- [ ] **Stripe Integration**: Complete payment processing
- [ ] **Subscription Lifecycle**: Handle upgrades, downgrades, cancellations
- [ ] **Usage Metering**: Track and bill based on usage
- [ ] **Invoice Generation**: Automatic invoice creation
- [ ] **Payment Methods**: Multiple payment method support
- [ ] **Billing Portal**: Customer self-service billing portal
- [ ] **Tax Calculation**: International tax handling
- [ ] **Webhook Handlers**: Stripe webhook processing
- [ ] **Trial Management**: Free trial with automatic conversion
- [ ] **Refund Processing**: Automated refund handling

---

### 🐳 **Docker Integration**

#### ✅ Completed:
- Docker configuration UI
- Database deployment interface

#### ⚠️ Required:
- [ ] **Docker API Integration**: Connect to Docker daemon
- [ ] **Container Orchestration**: Start, stop, manage containers
- [ ] **Health Checks**: Monitor container health
- [ ] **Volume Management**: Persistent data storage
- [ ] **Network Configuration**: Container networking
- [ ] **Image Management**: Pull and manage Docker images
- [ ] **Resource Limits**: CPU, memory constraints
- [ ] **Multi-Container Apps**: Docker Compose support

---

### 🎨 **UI/UX Enhancements**

#### ⚠️ Required:
- [ ] **Onboarding Flow**: New user tutorial and guide
- [ ] **Empty States**: Better empty state designs
- [ ] **Loading Skeletons**: Skeleton screens for better perceived performance
- [ ] **Error Boundaries**: Graceful error handling
- [ ] **Accessibility**: WCAG 2.1 AA compliance
- [ ] **Keyboard Shortcuts**: Power user keyboard navigation
- [ ] **Mobile Responsive**: Better mobile experience
- [ ] **Offline Mode**: Progressive Web App (PWA) support
- [ ] **Search**: Global search across connections, queries, projects
- [ ] **Command Palette**: CMD+K command palette

---

### 📱 **Mobile Support**

#### ⚠️ Required:
- [ ] **Responsive Design**: Optimize all views for mobile
- [ ] **Mobile Navigation**: Touch-friendly navigation
- [ ] **Touch Gestures**: Swipe, pinch-to-zoom support
- [ ] **Mobile Query Editor**: Simplified mobile query interface
- [ ] **Push Notifications**: Mobile alert notifications
- [ ] **Native Apps**: Consider React Native for iOS/Android

---

### 🧪 **Testing**

#### ⚠️ Required:
- [ ] **Unit Tests**: Component and utility function tests
- [ ] **Integration Tests**: API and database integration tests
- [ ] **E2E Tests**: End-to-end user flow tests (Playwright, Cypress)
- [ ] **Performance Tests**: Load and stress testing
- [ ] **Security Tests**: Penetration testing and security audits
- [ ] **Accessibility Tests**: Automated a11y testing

---

### 📈 **Performance Optimization**

#### ⚠️ Required:
- [ ] **Code Splitting**: Dynamic imports and lazy loading
- [ ] **CDN Integration**: Asset delivery via CDN
- [ ] **Caching Strategy**: Implement service workers and caching
- [ ] **Database Indexing**: Optimize database queries with indexes
- [ ] **Query Result Caching**: Cache frequent query results
- [ ] **WebSocket Optimization**: Efficient real-time updates
- [ ] **Image Optimization**: Lazy loading and responsive images
- [ ] **Bundle Size Optimization**: Tree shaking and minification

---

### 📚 **Documentation**

#### ⚠️ Required:
- [ ] **User Documentation**: Complete user guide
- [ ] **API Documentation**: REST API documentation
- [ ] **Developer Documentation**: Plugin development guide
- [ ] **Video Tutorials**: Screen recordings for key features
- [ ] **FAQ**: Frequently asked questions
- [ ] **Changelog**: Version history and release notes
- [ ] **Architecture Guide**: System architecture documentation
- [ ] **Deployment Guide**: Production deployment instructions

---

### 🔧 **DevOps & Infrastructure**

#### ⚠️ Required:
- [ ] **CI/CD Pipeline**: Automated testing and deployment
- [ ] **Docker Images**: Containerized application
- [ ] **Kubernetes Manifests**: K8s deployment configurations
- [ ] **Environment Management**: Staging, production environments
- [ ] **Log Management**: Centralized logging (ELK, CloudWatch)
- [ ] **Monitoring**: Application monitoring (Datadog, New Relic)
- [ ] **Backup Strategy**: Automated database backups
- [ ] **Disaster Recovery**: DR plan and testing
- [ ] **SSL Certificates**: HTTPS everywhere
- [ ] **Domain Configuration**: Custom domain support

---

### 🔒 **Compliance & Legal**

#### ⚠️ Required:
- [ ] **Privacy Policy**: GDPR-compliant privacy policy
- [ ] **Terms of Service**: Clear terms and conditions
- [ ] **Cookie Consent**: Cookie banner and preferences
- [ ] **Data Retention**: Data retention policies
- [ ] **Data Export**: User data export functionality
- [ ] **Account Deletion**: Complete account deletion
- [ ] **GDPR Compliance**: Right to be forgotten, data portability
- [ ] **SOC 2 Type II**: Security compliance certification
- [ ] **HIPAA Compliance**: Healthcare data compliance (if applicable)

---

## 🎯 Priority Roadmap

### **Phase 1: MVP Core (2-3 months)**
1. User authentication (sign-up, login, password reset)
2. Real database connections (PostgreSQL, MySQL)
3. Query execution and result display
4. Basic monitoring dashboard
5. Production deployment setup

### **Phase 2: AI Integration (2-3 months)**
6. OpenAI/Claude integration for NL→SQL
7. Voice command implementation
8. AI query optimization
9. Auto API generator backend
10. Data masking ML models

### **Phase 3: Team Features (2 months)**
11. Team invitations and management
12. Shared workspaces
13. Permission enforcement
14. Activity notifications

### **Phase 4: Enterprise (2-3 months)**
15. Stripe billing integration
16. Advanced monitoring and alerting
17. Audit logging
18. Compliance features (GDPR, SOC 2)

### **Phase 5: Scale & Polish (Ongoing)**
19. Performance optimization
20. Mobile optimization
21. Extension marketplace
22. Advanced features and plugins

---

## 📊 Technology Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions) |
| **Database** | PostgreSQL with RLS |
| **Real-time** | Supabase Realtime |
| **Icons** | Lucide React |
| **State** | React Context API |
| **Build** | Vite |
| **Linting** | ESLint |
| **Type Checking** | TypeScript |

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and code of conduct before submitting PRs.

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

- **Documentation**: [docs.queryflux.io](https://docs.queryflux.io)
- **Email**: support@queryflux.io
- **Discord**: [Join our community](https://discord.gg/queryflux)
- **Twitter**: [@QueryFlux](https://twitter.com/queryflux)

---

## 🙏 Acknowledgments

Built with ❤️ using:
- [React](https://react.dev)
- [Supabase](https://supabase.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Lucide Icons](https://lucide.dev)
- [Vite](https://vitejs.dev)

---

**QueryFlux** - *Database Management, Reimagined with AI*

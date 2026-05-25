# Frequently Asked Questions (FAQ)

## General Questions

### What is Multi-Database Manager?

Multi-Database Manager is a comprehensive database management application for macOS that provides a unified interface for working with multiple database types including PostgreSQL, MySQL, MongoDB, Redis, and SQLite. It features native macOS integration, Docker container management, and mobile companion apps.

### Which databases are supported?

Currently supported databases:
- **SQL Databases**: PostgreSQL, MySQL/MariaDB, SQLite
- **NoSQL Databases**: MongoDB, Redis

We're continuously adding support for additional database types based on user feedback.

### What are the system requirements?

- macOS 10.15 (Catalina) or later
- 4GB RAM minimum, 8GB recommended
- 2GB available disk space
- Docker Desktop (optional, for container management)
- Internet connection (for cloud databases and updates)

### Is there a free trial?

Yes! We offer a 30-day free trial with full access to all features. No credit card required to start your trial.

## Installation and Setup

### How do I install the application?

You can install Multi-Database Manager in two ways:

1. **Mac App Store** (Recommended):
   - Search for "Multi-Database Manager"
   - Click "Get" or "Install"

2. **Direct Download**:
   - Download from our website
   - Open the .dmg file and drag to Applications

### Do I need Docker to use the application?

Docker is optional. You need Docker Desktop only if you want to:
- Create and manage database containers
- Use the built-in database templates
- Deploy development databases quickly

All other features work without Docker.

### How do I update the application?

- **App Store version**: Updates automatically through the App Store
- **Direct download version**: Check for updates in the application menu or download the latest version from our website

## Database Connections

### Can I connect to cloud databases?

Yes! The application works with all major cloud database providers:
- AWS RDS (PostgreSQL, MySQL)
- Google Cloud SQL
- Azure Database
- MongoDB Atlas
- Redis Cloud
- And many others

### How are my credentials stored?

All database credentials are securely stored in the macOS Keychain using industry-standard encryption. The application never stores passwords in plain text.

### Can I import connection settings from other tools?

Yes, you can import connection profiles from:
- pgAdmin (PostgreSQL)
- MySQL Workbench
- MongoDB Compass
- Other database tools (via CSV/JSON export)

### How many databases can I connect to simultaneously?

There's no hard limit on concurrent connections. The practical limit depends on:
- Available system memory
- Database server connection limits
- Network bandwidth

We recommend monitoring performance with many concurrent connections.

## Features and Functionality

### Can I edit data directly in the application?

Yes! The application provides an Excel-like data editing interface with:
- Direct cell editing
- Add/delete rows and columns
- Data validation
- Undo/redo functionality
- Bulk operations

### What file formats can I import/export?

**Import formats**:
- SQL dumps (.sql)
- CSV files (.csv)
- JSON documents (.json)
- Excel files (.xlsx, .xls)
- XML data (.xml)
- Database-specific formats

**Export formats**:
- SQL dumps with schema
- CSV with custom delimiters
- JSON with formatting
- Excel workbooks
- PDF reports

### Does it support SQL syntax highlighting?

Yes! The query editor includes:
- Syntax highlighting for all supported databases
- Auto-completion for tables and columns
- Query formatting and validation
- Error highlighting
- Multiple database dialect support

### Can I create database schemas visually?

Yes, the application includes a visual schema designer that allows you to:
- Create and modify tables
- Define relationships and constraints
- Generate migration scripts
- Compare schemas between databases

## Docker Integration

### What Docker features are included?

The Docker integration provides:
- Pre-configured database templates
- Container lifecycle management (start, stop, restart)
- Real-time monitoring and logs
- Automatic port allocation
- Volume management for data persistence
- Resource usage tracking

### Can I use existing Docker containers?

Yes! The application can discover and manage existing database containers. It will automatically detect containers running supported database types.

### What happens to my data when I remove a container?

By default, container data is stored in Docker volumes that persist even after container removal. The application will warn you before removing containers and offer backup options.

## Mobile App

### Is there a mobile app?

Yes! We provide iOS companion apps that allow you to:
- Monitor database connections
- View performance metrics
- Execute simple queries
- Receive push notifications for alerts
- Access query history

### How do I connect the mobile app to my desktop?

1. Ensure both devices are on the same network
2. Open the mobile app and scan the QR code displayed in the desktop app
3. Authenticate using Touch ID/Face ID or passcode

### Can I perform all operations from the mobile app?

The mobile app is designed for monitoring and basic operations. Complex tasks like schema editing, large data imports, and advanced queries are best performed on the desktop application.

## Performance and Optimization

### Why are my queries running slowly?

Common causes of slow queries:
- Missing indexes on queried columns
- Large result sets without LIMIT clauses
- Inefficient JOIN operations
- Outdated database statistics
- Network latency for remote databases

Use the built-in query analyzer to identify performance bottlenecks.

### How can I optimize database performance?

The application provides several optimization tools:
- Query execution plan analysis
- Index usage recommendations
- Performance monitoring dashboard
- Slow query identification
- Resource usage tracking

### Can I monitor multiple databases simultaneously?

Yes! The performance dashboard can monitor multiple database connections simultaneously, showing:
- Connection status
- Query execution times
- Resource usage
- Active connections
- Performance trends

## Security and Privacy

### How secure is my data?

We take security seriously:
- All credentials stored in macOS Keychain
- SSL/TLS encryption for database connections
- No data transmitted to our servers
- Local data processing only
- Regular security audits

### Can I use two-factor authentication?

Yes, the application supports:
- Database-level 2FA (where supported by the database)
- macOS Touch ID/Face ID for application access
- Integration with authentication providers

### Is my query history private?

Yes, all query history is stored locally on your device. We never transmit or store your queries on our servers.

## Licensing and Pricing

### What's included in the license?

A single license includes:
- Desktop application for macOS
- iOS companion app
- All current features
- Free updates for one year
- Email support

### Can I use it for commercial purposes?

Yes, the standard license permits commercial use. For enterprise deployments, please contact us for volume licensing options.

### Do you offer educational discounts?

Yes! We offer significant discounts for:
- Students (with valid student ID)
- Educational institutions
- Non-profit organizations

Contact us for educational pricing information.

### What happens when my license expires?

After one year:
- The application continues to work with all features
- You won't receive new feature updates
- Security updates are provided for an additional year
- You can renew at a discounted rate

## Troubleshooting

### The application won't start. What should I do?

1. Check system requirements (macOS version, disk space)
2. Try restarting your Mac
3. Reset application preferences (see troubleshooting guide)
4. Contact support if the issue persists

### I can't connect to my database. Help!

Common solutions:
1. Verify database server is running
2. Check host, port, and credentials
3. Test network connectivity
4. Review firewall settings
5. Check database server logs

See our detailed troubleshooting guide for more solutions.

### My import is failing. What's wrong?

Check for:
- File format compatibility
- File size (very large files may need to be split)
- Character encoding issues
- Data validation errors
- Available disk space

### The application is running slowly. How can I fix this?

Try these steps:
1. Close unused database connections
2. Restart the application
3. Check available system memory
4. Update to the latest version
5. Contact support for performance analysis

## Data Migration and Integration

### Can I migrate data between different database types?

Yes! The application supports cross-database migrations:
- PostgreSQL ↔ MySQL
- SQL databases → MongoDB (with schema transformation)
- CSV/Excel → Any supported database
- Custom transformation rules available

### How do I backup my connection profiles?

Connection profiles can be exported from the application:
1. Go to File → Export → Connection Profiles
2. Choose export location
3. Credentials are excluded for security

### Can I automate repetitive tasks?

The application supports:
- Scheduled exports/imports
- Query automation
- Container management scripts
- Custom workflows (Pro version)

## Support and Community

### How do I get help?

Multiple support options:
- **Documentation**: Comprehensive user guides and tutorials
- **In-app help**: Context-sensitive help system
- **Email support**: support@multi-db-manager.com
- **Community forum**: User discussions and tips
- **Video tutorials**: Step-by-step guides

### How quickly do you respond to support requests?

Support response times:
- **Critical issues**: Within 4 hours
- **General questions**: Within 24 hours
- **Feature requests**: Within 48 hours

### Can I request new features?

Absolutely! We welcome feature requests:
- Submit through the application (Help → Feature Request)
- Email us at features@multi-db-manager.com
- Vote on existing requests in our community forum

### Is there a user community?

Yes! Join our community:
- **Forum**: Share tips and get help from other users
- **Discord**: Real-time chat with users and developers
- **Newsletter**: Monthly updates and tips
- **Blog**: Tutorials and best practices

## Technical Questions

### What programming languages is it built with?

The application is built using:
- **Desktop**: Python with PySide6 (Qt)
- **Mobile**: React Native
- **Backend**: FastAPI for mobile integration

### Can I extend the application with plugins?

Currently, the application doesn't support third-party plugins, but we're considering this for future versions. Let us know if you're interested!

### Does it work with database proxies or connection poolers?

Yes, the application works with:
- PgBouncer (PostgreSQL)
- ProxySQL (MySQL)
- MongoDB connection pooling
- Custom proxy solutions

### Can I use it with VPNs?

Yes, the application works seamlessly with VPN connections. Just ensure your VPN allows database traffic on the required ports.

## Future Development

### What new features are planned?

Upcoming features include:
- Additional database support (Oracle, SQL Server)
- Advanced analytics and reporting
- Team collaboration features
- API for automation
- Enhanced mobile capabilities

### How often do you release updates?

We follow a regular release schedule:
- **Major releases**: Every 6 months
- **Minor updates**: Monthly
- **Security patches**: As needed
- **Beta releases**: Available for testing new features

### Can I influence the development roadmap?

Yes! We prioritize features based on:
- User feedback and requests
- Community voting
- Business impact
- Technical feasibility

Your input helps shape the future of Multi-Database Manager!

---

**Still have questions?** Contact our support team at support@multi-db-manager.com or use the in-app help system. We're here to help!
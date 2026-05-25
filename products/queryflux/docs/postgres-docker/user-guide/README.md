# Multi-Database Manager User Guide

Welcome to the Multi-Database Manager - your comprehensive solution for managing multiple database types from a single, native macOS application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [First Launch](#first-launch)
4. [Managing Connections](#managing-connections)
5. [Database Operations](#database-operations)
6. [Docker Integration](#docker-integration)
7. [Import/Export](#import-export)
8. [Mobile App](#mobile-app)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

## Getting Started

The Multi-Database Manager is designed to provide a unified interface for working with multiple database types including:

- **SQL Databases**: PostgreSQL, MySQL/MariaDB, SQLite
- **NoSQL Databases**: MongoDB, Redis

### Key Features

- **Native macOS Integration**: Follows Apple Human Interface Guidelines
- **Docker Container Management**: Deploy and manage database containers
- **Advanced Data Editing**: Spreadsheet-like interface for data manipulation
- **Import/Export Engine**: Support for multiple file formats
- **Mobile Companion App**: Monitor databases from your iOS device
- **Security**: Keychain integration for secure credential storage

## Installation

### System Requirements

- macOS 10.15 (Catalina) or later
- 4GB RAM minimum, 8GB recommended
- 2GB available disk space
- Docker Desktop (for container management features)

### Installation Methods

#### Method 1: Mac App Store (Recommended)
1. Open the Mac App Store
2. Search for "Multi-Database Manager"
3. Click "Get" or "Install"
4. Launch from Applications folder

#### Method 2: Direct Download
1. Download the latest release from our website
2. Open the downloaded `.dmg` file
3. Drag the application to your Applications folder
4. Launch from Applications folder

### First Launch Setup

When you first launch the application:

1. **Grant Permissions**: The app will request permissions for:
   - Keychain access (for secure credential storage)
   - Network access (for database connections)
   - File system access (for import/export operations)

2. **Docker Setup** (Optional):
   - If you plan to use Docker features, ensure Docker Desktop is installed
   - The app will detect Docker automatically

## Managing Connections

### Creating a New Connection

1. **Open Connection Dialog**:
   - Click "New Connection" in the toolbar
   - Use keyboard shortcut `Cmd+N`
   - Select "File" → "New Connection" from menu

2. **Select Database Type**:
   - Choose from PostgreSQL, MySQL, MongoDB, Redis, or SQLite
   - Each type shows appropriate connection fields

3. **Enter Connection Details**:
   - **Host**: Database server address
   - **Port**: Database port (auto-filled with defaults)
   - **Username/Password**: Authentication credentials
   - **Database Name**: Target database (if applicable)

4. **Test Connection**:
   - Click "Test Connection" to verify settings
   - Green checkmark indicates success

5. **Save Profile**:
   - Give your connection a memorable name
   - Add tags for organization
   - Mark as favorite if frequently used

### Connection Security

All credentials are automatically stored in the macOS Keychain for maximum security. You can:

- Enable Touch ID/Face ID authentication
- Use SSH tunnels for remote connections
- Configure SSL/TLS encryption

### Managing Connection Profiles

- **Edit**: Right-click connection → "Edit"
- **Duplicate**: Right-click connection → "Duplicate"
- **Delete**: Right-click connection → "Delete"
- **Export**: Share connection profiles (credentials excluded)

## Database Operations

### Data Browsing

1. **Schema Explorer**:
   - Navigate database structure in the left sidebar
   - Expand databases, schemas, and tables
   - Right-click for context actions

2. **Table Data View**:
   - Click any table to view data
   - Use pagination for large datasets
   - Sort columns by clicking headers

### Data Editing

The application provides Excel-like data editing:

1. **Edit Cells**:
   - Double-click any cell to edit
   - Press Enter to confirm changes
   - Press Escape to cancel

2. **Add/Delete Rows**:
   - Right-click row number for options
   - Use toolbar buttons for quick actions
   - Bulk operations available

3. **Data Validation**:
   - Real-time validation based on column types
   - Error highlighting for invalid data
   - Constraint checking before save

### Query Editor

1. **SQL Editor**:
   - Syntax highlighting for all supported databases
   - Auto-completion for tables and columns
   - Query formatting and validation

2. **Execute Queries**:
   - Run with `Cmd+R` or toolbar button
   - View results in tabbed interface
   - Export results to various formats

3. **Query History**:
   - Access previously executed queries
   - Save frequently used queries
   - Organize with folders and tags

## Docker Integration

### Container Management

1. **View Containers**:
   - Access Docker panel from sidebar
   - See all database containers and their status
   - Monitor resource usage

2. **Create New Container**:
   - Click "New Container" button
   - Select database type from templates
   - Configure ports and volumes
   - Set environment variables

3. **Container Operations**:
   - Start/Stop containers
   - View logs in real-time
   - Access container shell
   - Backup container data

### Pre-configured Templates

Available container templates:

- **PostgreSQL**: Latest version with persistent data
- **MySQL**: Configurable version with custom settings
- **MongoDB**: Replica set ready configuration
- **Redis**: Persistent storage with custom config
- **SQLite**: File-based with volume mounting

## Import/Export

### Supported Formats

**Import Formats**:
- SQL dumps (.sql)
- CSV files (.csv)
- JSON documents (.json)
- Excel files (.xlsx, .xls)
- XML data (.xml)

**Export Formats**:
- SQL dumps with schema
- CSV with custom delimiters
- JSON with formatting options
- Excel with multiple sheets
- PDF reports

### Import Process

1. **Select Source**:
   - Choose file or drag-and-drop
   - Format auto-detection
   - Preview data before import

2. **Configure Options**:
   - Target table selection
   - Column mapping
   - Data transformation rules
   - Error handling preferences

3. **Monitor Progress**:
   - Real-time progress bar
   - Detailed operation log
   - Error reporting with line numbers

### Export Process

1. **Select Data**:
   - Choose tables, views, or custom queries
   - Apply filters and sorting
   - Preview export data

2. **Configure Format**:
   - Select output format
   - Set formatting options
   - Choose compression settings

3. **Execute Export**:
   - Monitor progress
   - Verify output file
   - Share or backup exported data

## Mobile App

### iOS Companion App

The iOS companion app allows you to:

- Monitor database connections
- View real-time performance metrics
- Execute simple queries
- Receive push notifications for alerts
- Access recent query history

### Setup

1. **Download App**:
   - Install from iOS App Store
   - Search "Multi-Database Manager"

2. **Connect to Desktop**:
   - Ensure both devices on same network
   - Scan QR code from desktop app
   - Authenticate with Touch ID/Face ID

3. **Configure Notifications**:
   - Enable push notifications
   - Set alert thresholds
   - Choose notification types

## Troubleshooting

### Common Issues

#### Connection Problems

**Issue**: Cannot connect to database
**Solutions**:
1. Verify host and port settings
2. Check firewall and network connectivity
3. Confirm database server is running
4. Validate credentials and permissions

**Issue**: SSL/TLS connection errors
**Solutions**:
1. Verify SSL certificate validity
2. Check SSL mode settings
3. Update certificate trust settings
4. Contact database administrator

#### Performance Issues

**Issue**: Slow query execution
**Solutions**:
1. Check query execution plan
2. Review database indexes
3. Optimize query structure
4. Monitor database resources

**Issue**: Application freezing
**Solutions**:
1. Check available memory
2. Close unused connections
3. Restart application
4. Update to latest version

#### Docker Issues

**Issue**: Cannot start containers
**Solutions**:
1. Verify Docker Desktop is running
2. Check available disk space
3. Review port conflicts
4. Restart Docker service

### Getting Help

- **In-App Help**: Press `Cmd+?` for context help
- **Documentation**: Visit our online documentation
- **Support**: Contact support through the app
- **Community**: Join our user forum

## FAQ

### General Questions

**Q: Which databases are supported?**
A: PostgreSQL, MySQL/MariaDB, SQLite, MongoDB, and Redis are fully supported.

**Q: Can I use this with cloud databases?**
A: Yes, the app works with cloud providers like AWS RDS, Google Cloud SQL, and Azure Database.

**Q: Is my data secure?**
A: Yes, all credentials are stored in macOS Keychain, and connections use encryption when available.

### Technical Questions

**Q: Can I import large files?**
A: Yes, the app uses streaming import for files of any size with progress tracking.

**Q: Does it work offline?**
A: Local databases (SQLite) and Docker containers work offline. Remote connections require internet.

**Q: Can I customize the interface?**
A: Yes, the app supports light/dark themes and customizable layouts.

### Licensing Questions

**Q: Is there a free trial?**
A: Yes, a 30-day free trial is available with all features.

**Q: What's included in the license?**
A: Desktop app, mobile app, and all features with free updates for one year.

**Q: Can I use it commercially?**
A: Yes, commercial use is permitted under the standard license.

---

For additional help, visit our [support website](https://support.multi-db-manager.com) or contact us at support@multi-db-manager.com.
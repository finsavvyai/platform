# Troubleshooting Guide

This comprehensive guide helps you resolve common issues with the Multi-Database Manager.

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Performance Problems](#performance-problems)
3. [Docker Issues](#docker-issues)
4. [Import/Export Problems](#importexport-problems)
5. [GUI Issues](#gui-issues)
6. [Mobile App Issues](#mobile-app-issues)
7. [Security Issues](#security-issues)
8. [Installation Problems](#installation-problems)
9. [Diagnostic Tools](#diagnostic-tools)
10. [Getting Help](#getting-help)

## Connection Issues

### Cannot Connect to Database

**Symptoms**: Connection fails with timeout or refused errors

**Common Causes and Solutions**:

1. **Database Server Not Running**
   ```bash
   # Check if PostgreSQL is running
   brew services list | grep postgresql
   sudo systemctl status postgresql
   
   # Check if MySQL is running
   brew services list | grep mysql
   sudo systemctl status mysql
   
   # Check if MongoDB is running
   brew services list | grep mongodb
   sudo systemctl status mongod
   ```

2. **Wrong Host or Port**
   - Verify server address and port number
   - For local connections, try both `localhost` and `127.0.0.1`
   - Check if custom ports are being used

3. **Firewall Blocking Connection**
   ```bash
   # Test port connectivity
   telnet hostname port
   nc -zv hostname port
   
   # Example: Test PostgreSQL connection
   nc -zv localhost 5432
   ```

4. **Network Issues**
   ```bash
   # Test basic connectivity
   ping hostname
   
   # Check DNS resolution
   nslookup hostname
   dig hostname
   ```

### Authentication Failures

**Symptoms**: "Access denied", "Authentication failed", "Invalid credentials"

**Solutions**:

1. **Verify Credentials**
   - Double-check username and password
   - Ensure caps lock is not on
   - Try connecting with command-line tools to verify credentials

2. **Check User Permissions**
   ```sql
   -- PostgreSQL: Check user exists and permissions
   SELECT * FROM pg_user WHERE usename = 'your_username';
   \du your_username
   
   -- MySQL: Check user and grants
   SELECT User, Host FROM mysql.user WHERE User = 'your_username';
   SHOW GRANTS FOR 'your_username'@'your_host';
   ```

3. **Authentication Method Issues**
   - PostgreSQL: Check pg_hba.conf for allowed authentication methods
   - MySQL: Verify authentication plugin compatibility
   - MongoDB: Ensure correct authentication database

### SSL/TLS Connection Problems

**Symptoms**: SSL handshake failures, certificate errors

**Solutions**:

1. **Certificate Issues**
   - Verify certificate validity and expiration
   - Check certificate chain completeness
   - Ensure proper certificate format (PEM, DER)

2. **SSL Configuration**
   - Try different SSL modes (require, prefer, allow)
   - Verify server SSL configuration
   - Check if self-signed certificates are being used

3. **Trust Store Issues**
   - Add certificates to system trust store
   - Specify custom CA certificates in connection settings
   - Disable certificate verification for testing (not recommended for production)

## Performance Problems

### Slow Query Execution

**Symptoms**: Queries take longer than expected to complete

**Diagnostic Steps**:

1. **Check Query Execution Plan**
   ```sql
   -- PostgreSQL
   EXPLAIN ANALYZE SELECT * FROM table WHERE condition;
   
   -- MySQL
   EXPLAIN FORMAT=JSON SELECT * FROM table WHERE condition;
   
   -- MongoDB
   db.collection.find({condition}).explain("executionStats");
   ```

2. **Monitor Database Performance**
   - Use built-in performance dashboard
   - Check CPU and memory usage
   - Monitor active connections

3. **Index Analysis**
   ```sql
   -- PostgreSQL: Check index usage
   SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes;
   
   -- MySQL: Check index usage
   SELECT * FROM sys.schema_unused_indexes;
   
   -- MongoDB: Check index usage
   db.collection.getIndexes();
   db.collection.aggregate([{$indexStats: {}}]);
   ```

**Solutions**:

1. **Add Missing Indexes**
   - Create indexes for frequently queried columns
   - Use composite indexes for multi-column queries
   - Consider partial indexes for filtered queries

2. **Optimize Queries**
   - Rewrite inefficient queries
   - Use appropriate JOIN types
   - Limit result sets with WHERE clauses
   - Use LIMIT for large result sets

3. **Database Tuning**
   - Adjust buffer pool sizes
   - Optimize connection settings
   - Update database statistics
   - Consider partitioning for large tables

### Application Freezing or Hanging

**Symptoms**: Application becomes unresponsive

**Immediate Actions**:

1. **Force Quit Application**
   - Press `Cmd+Option+Esc` to open Force Quit dialog
   - Select Multi-Database Manager and click "Force Quit"

2. **Check System Resources**
   ```bash
   # Check memory usage
   top -o MEM
   
   # Check CPU usage
   top -o CPU
   
   # Check disk space
   df -h
   ```

**Prevention**:

1. **Limit Large Operations**
   - Use pagination for large result sets
   - Break large imports into smaller chunks
   - Set query timeouts

2. **Monitor Resource Usage**
   - Close unused connections
   - Limit concurrent operations
   - Monitor memory consumption

## Docker Issues

### Docker Desktop Not Running

**Symptoms**: "Cannot connect to Docker daemon"

**Solutions**:

1. **Start Docker Desktop**
   - Launch Docker Desktop from Applications
   - Wait for Docker to fully start (whale icon in menu bar)
   - Verify Docker is running: `docker version`

2. **Docker Service Issues**
   ```bash
   # Restart Docker Desktop
   killall Docker && open /Applications/Docker.app
   
   # Check Docker status
   docker system info
   ```

### Container Creation Failures

**Symptoms**: Containers fail to start or create

**Common Issues**:

1. **Port Conflicts**
   ```bash
   # Check what's using a port
   lsof -i :5432
   netstat -an | grep 5432
   
   # Find available ports
   for port in {5433..5440}; do
     if ! lsof -i :$port > /dev/null; then
       echo "Port $port is available"
     fi
   done
   ```

2. **Insufficient Resources**
   - Check available disk space
   - Verify Docker resource limits in preferences
   - Clean up unused containers and images:
   ```bash
   docker system prune -a
   docker volume prune
   ```

3. **Image Pull Failures**
   ```bash
   # Manually pull image
   docker pull postgres:15
   docker pull mysql:8.0
   docker pull mongo:6.0
   
   # Check Docker Hub connectivity
   docker search postgres
   ```

### Container Performance Issues

**Symptoms**: Slow container performance

**Solutions**:

1. **Resource Allocation**
   - Increase Docker Desktop memory allocation
   - Adjust CPU limits in Docker preferences
   - Monitor container resource usage:
   ```bash
   docker stats container_name
   ```

2. **Volume Performance**
   - Use named volumes instead of bind mounts
   - Consider volume drivers for better performance
   - Check disk I/O performance

## Import/Export Problems

### Large File Import Failures

**Symptoms**: Import process fails or times out with large files

**Solutions**:

1. **Memory Issues**
   - Split large files into smaller chunks
   - Use streaming import options
   - Increase application memory limits

2. **Timeout Issues**
   - Increase import timeout settings
   - Use batch processing for large datasets
   - Monitor import progress and resume if needed

3. **File Format Issues**
   - Verify file format and encoding
   - Check for special characters or invalid data
   - Use file validation before import

### Export Format Problems

**Symptoms**: Exported files are corrupted or unreadable

**Solutions**:

1. **Encoding Issues**
   - Specify correct character encoding (UTF-8, Latin1)
   - Handle special characters properly
   - Use appropriate line endings for target system

2. **Data Type Conversion**
   - Review data type mappings
   - Handle NULL values appropriately
   - Consider precision loss in numeric conversions

## GUI Issues

### Application Won't Start

**Symptoms**: Application fails to launch or crashes on startup

**Solutions**:

1. **Check System Requirements**
   - Verify macOS version compatibility
   - Ensure sufficient disk space
   - Check for required system frameworks

2. **Reset Application Preferences**
   ```bash
   # Remove preference files
   rm ~/Library/Preferences/com.multi-db-manager.plist
   rm -rf ~/Library/Application\ Support/Multi-Database\ Manager/
   ```

3. **Check Console Logs**
   - Open Console.app
   - Filter for "Multi-Database Manager"
   - Look for error messages and stack traces

### Display Issues

**Symptoms**: UI elements not displaying correctly, layout problems

**Solutions**:

1. **Display Settings**
   - Check display scaling settings
   - Try different display resolutions
   - Reset window positions: `Cmd+Shift+R`

2. **Theme Issues**
   - Switch between light and dark themes
   - Reset to default theme settings
   - Check system appearance settings

### Keyboard Shortcuts Not Working

**Symptoms**: Keyboard shortcuts don't respond

**Solutions**:

1. **Check System Preferences**
   - Verify keyboard shortcuts in System Preferences
   - Check for conflicting shortcuts with other apps
   - Reset keyboard shortcuts to defaults

2. **Application Focus**
   - Ensure application has focus
   - Check if modal dialogs are blocking input
   - Try clicking in the application window first

## Mobile App Issues

### Cannot Connect to Desktop App

**Symptoms**: Mobile app can't find or connect to desktop application

**Solutions**:

1. **Network Connectivity**
   - Ensure both devices on same Wi-Fi network
   - Check firewall settings on desktop
   - Verify desktop app is running and API server is enabled

2. **QR Code Scanning Issues**
   - Ensure good lighting for QR code scanning
   - Try manual IP address entry
   - Check camera permissions on mobile device

### Push Notifications Not Working

**Symptoms**: Not receiving database alerts on mobile device

**Solutions**:

1. **Notification Permissions**
   - Check notification permissions in iOS Settings
   - Verify notification settings in app
   - Test with manual notification

2. **Background App Refresh**
   - Enable Background App Refresh for the app
   - Check Low Power Mode settings
   - Verify app is not being killed by iOS

## Security Issues

### Keychain Access Problems

**Symptoms**: Cannot save or retrieve passwords from Keychain

**Solutions**:

1. **Keychain Permissions**
   - Grant Keychain access when prompted
   - Check Keychain Access.app for stored items
   - Reset Keychain if corrupted:
   ```bash
   # Reset login keychain (use with caution)
   security delete-keychain login.keychain
   ```

2. **Application Signing**
   - Verify application is properly signed
   - Check Gatekeeper settings
   - Try running with elevated permissions (not recommended)

### Certificate Validation Errors

**Symptoms**: SSL certificate validation failures

**Solutions**:

1. **Certificate Trust**
   - Add certificates to system trust store
   - Use Keychain Access to manage certificates
   - Verify certificate chain completeness

2. **Date/Time Issues**
   - Check system date and time
   - Verify time zone settings
   - Ensure NTP synchronization

## Installation Problems

### App Store Installation Issues

**Symptoms**: Cannot download or install from App Store

**Solutions**:

1. **App Store Issues**
   - Sign out and back into App Store
   - Check available storage space
   - Restart App Store application

2. **System Requirements**
   - Verify macOS version compatibility
   - Check processor architecture (Intel vs Apple Silicon)
   - Ensure sufficient disk space

### Direct Download Issues

**Symptoms**: Downloaded app won't open or is damaged

**Solutions**:

1. **Gatekeeper Issues**
   ```bash
   # Allow app to run (use with caution)
   sudo spctl --master-disable
   
   # Remove quarantine attribute
   xattr -d com.apple.quarantine /Applications/Multi-Database\ Manager.app
   ```

2. **Download Corruption**
   - Re-download the application
   - Verify download checksum if provided
   - Try downloading from different network

## Diagnostic Tools

### Built-in Diagnostics

1. **Connection Test**
   - Use "Test Connection" in connection dialog
   - Check connection status indicators
   - Review connection logs

2. **Performance Monitor**
   - Access performance dashboard
   - Monitor query execution times
   - Check resource usage graphs

3. **Log Viewer**
   - Access application logs from Help menu
   - Filter logs by severity level
   - Export logs for support analysis

### System Diagnostics

1. **Network Diagnostics**
   ```bash
   # Test network connectivity
   ping google.com
   
   # Check DNS resolution
   nslookup database-server.com
   
   # Test specific port
   nc -zv hostname port
   ```

2. **System Information**
   ```bash
   # Check system info
   system_profiler SPSoftwareDataType
   
   # Check memory usage
   vm_stat
   
   # Check disk usage
   df -h
   ```

### Database-Specific Diagnostics

1. **PostgreSQL**
   ```sql
   -- Check server status
   SELECT version();
   SELECT current_database();
   
   -- Check connections
   SELECT * FROM pg_stat_activity;
   ```

2. **MySQL**
   ```sql
   -- Check server status
   SELECT VERSION();
   SHOW STATUS;
   
   -- Check connections
   SHOW PROCESSLIST;
   ```

3. **MongoDB**
   ```javascript
   // Check server status
   db.runCommand({serverStatus: 1});
   
   // Check connections
   db.runCommand({currentOp: true});
   ```

## Getting Help

### Self-Help Resources

1. **Documentation**
   - Check user guide and tutorials
   - Review FAQ section
   - Search knowledge base

2. **Community Forums**
   - Post questions in user forums
   - Search existing discussions
   - Share solutions with other users

### Contacting Support

1. **Prepare Information**
   - Application version number
   - macOS version
   - Database type and version
   - Error messages and screenshots
   - Steps to reproduce the issue

2. **Support Channels**
   - In-app support (Help → Contact Support)
   - Email: support@multi-db-manager.com
   - Online chat (available during business hours)

3. **Log Collection**
   ```bash
   # Collect application logs
   # Logs are typically located at:
   ~/Library/Logs/Multi-Database Manager/
   
   # System logs
   log show --predicate 'subsystem contains "multi-db-manager"' --last 1h
   ```

### Emergency Procedures

1. **Data Recovery**
   - Check automatic backup locations
   - Use Time Machine if available
   - Contact support for data recovery assistance

2. **Application Reset**
   ```bash
   # Complete application reset (removes all settings)
   rm -rf ~/Library/Application\ Support/Multi-Database\ Manager/
   rm ~/Library/Preferences/com.multi-db-manager.plist
   rm -rf ~/Library/Caches/com.multi-db-manager/
   ```

3. **System Restore**
   - Use Time Machine to restore previous state
   - Consider system restore if issues persist
   - Backup important data before system changes

## Prevention Tips

### Regular Maintenance

1. **Keep Software Updated**
   - Enable automatic updates
   - Regularly check for new versions
   - Update database servers and drivers

2. **Monitor Performance**
   - Regular performance reviews
   - Monitor disk space usage
   - Check for slow queries

3. **Backup Strategy**
   - Regular database backups
   - Export connection profiles
   - Document configuration settings

### Best Practices

1. **Connection Management**
   - Use connection pooling appropriately
   - Close unused connections
   - Monitor connection limits

2. **Query Optimization**
   - Regular index maintenance
   - Query performance reviews
   - Use appropriate data types

3. **Security Practices**
   - Regular password updates
   - Use SSL/TLS connections
   - Monitor access logs

Remember: When in doubt, don't hesitate to contact our support team. We're here to help you get the most out of Multi-Database Manager!
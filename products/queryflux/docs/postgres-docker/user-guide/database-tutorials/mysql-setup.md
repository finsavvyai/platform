# MySQL/MariaDB Setup Tutorial

This tutorial covers connecting to MySQL and MariaDB databases using the Multi-Database Manager.

## Prerequisites

- MySQL or MariaDB server
- Database credentials
- Network access to the database server

## Connection Setup

### Step 1: Open Connection Dialog

1. Launch Multi-Database Manager
2. Click "New Connection" or press `Cmd+N`
3. Select "MySQL" from the database type dropdown

### Step 2: Configure Connection Parameters

**Basic Settings**:
- **Connection Name**: Descriptive name for your connection
- **Host**: MySQL server address
  - Local: `localhost` or `127.0.0.1`
  - Remote: Server IP or hostname
- **Port**: Default is `3306`
- **Database**: Target database name (optional)
- **Username**: MySQL username
- **Password**: User password

### Step 3: Advanced Configuration

Click "Advanced" for additional options:

- **Charset**: Character set (default: utf8mb4)
- **Collation**: Collation rules
- **SSL Mode**: SSL connection settings
- **Connection Timeout**: Timeout in seconds
- **Auto-reconnect**: Automatic reconnection on connection loss

### Step 4: Test and Save

1. Click "Test Connection"
2. Verify successful connection
3. Save the connection profile

## MySQL vs MariaDB

The Multi-Database Manager supports both MySQL and MariaDB:

### MySQL Versions Supported
- MySQL 5.7+
- MySQL 8.0+

### MariaDB Versions Supported
- MariaDB 10.3+
- MariaDB 10.4+
- MariaDB 10.5+
- MariaDB 10.6+

### Key Differences
- MariaDB has additional storage engines
- Some syntax differences in advanced features
- Different default settings and behaviors

## Docker MySQL/MariaDB Setup

### MySQL Container

1. Open Docker panel
2. Click "New Container"
3. Select "MySQL" template
4. Configure:
   - **Container Name**: `mysql-dev`
   - **Port**: `3306`
   - **Root Password**: Secure password
   - **Database**: Optional initial database
   - **User/Password**: Optional non-root user

### MariaDB Container

Similar process but select "MariaDB" template:

```bash
# Manual Docker command
docker run --name mariadb-dev \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=mydb \
  -e MYSQL_USER=myuser \
  -e MYSQL_PASSWORD=mypassword \
  -p 3306:3306 \
  -v mariadb_data:/var/lib/mysql \
  -d mariadb:10.6
```

## Cloud MySQL Setup

### AWS RDS MySQL

1. Get connection details from AWS Console:
   - Endpoint URL
   - Port (usually 3306)
   - Database name
   - Master username
2. Configure security groups
3. Use endpoint as host

### Google Cloud SQL MySQL

1. Get connection details:
   - Public IP address
   - Database name
   - Username/password
2. Add authorized networks
3. Enable SSL if required

### Azure Database for MySQL

1. Get server details from Azure Portal:
   - Server name
   - Database name
   - Admin username
2. Configure firewall rules
3. SSL is enforced by default

## SSL Configuration

### Enabling SSL

1. In Advanced settings, set SSL Mode:
   - **Disabled**: No SSL (not recommended for production)
   - **Preferred**: Use SSL if available
   - **Required**: Force SSL connection
   - **Verify CA**: Verify certificate authority
   - **Verify Identity**: Full certificate verification

### SSL Certificates

For custom certificates:
1. Download SSL certificate files from your provider
2. In Advanced settings, specify certificate paths:
   - **SSL CA**: Certificate Authority file
   - **SSL Cert**: Client certificate
   - **SSL Key**: Client private key

## Common Connection Issues

### Authentication Problems

**Issue**: "Access denied for user"
**Solutions**:
1. Verify username and password
2. Check user privileges:
   ```sql
   SELECT User, Host FROM mysql.user WHERE User = 'your_username';
   SHOW GRANTS FOR 'your_username'@'your_host';
   ```
3. Ensure user can connect from your IP:
   ```sql
   CREATE USER 'username'@'%' IDENTIFIED BY 'password';
   GRANT ALL PRIVILEGES ON database.* TO 'username'@'%';
   FLUSH PRIVILEGES;
   ```

**Issue**: "Host is not allowed to connect"
**Solutions**:
1. Check MySQL bind-address setting
2. Configure firewall rules
3. Update user host permissions

### Connection Refused

**Issue**: "Connection refused"
**Solutions**:
1. Verify MySQL service is running:
   ```bash
   # Linux/macOS
   sudo systemctl status mysql
   # or
   brew services list | grep mysql
   ```
2. Check port availability:
   ```bash
   netstat -an | grep 3306
   ```
3. Verify firewall settings

## Performance Optimization

### Connection Settings

Optimize connection parameters:
- **max_connections**: Increase if needed
- **connect_timeout**: Adjust for network conditions
- **wait_timeout**: Set appropriate session timeout
- **interactive_timeout**: For interactive sessions

### Query Performance

Use built-in tools:
1. Execute query
2. Click "Explain Plan"
3. Review execution plan
4. Follow optimization suggestions

### Indexing

Monitor index usage:
```sql
-- Show indexes for a table
SHOW INDEX FROM table_name;

-- Find unused indexes
SELECT * FROM sys.schema_unused_indexes;

-- Find duplicate indexes
SELECT * FROM sys.schema_redundant_indexes;
```

## Backup and Restore

### Creating Backups

1. Right-click database in schema browser
2. Select "Export" → "MySQL Dump"
3. Choose options:
   - **Structure Only**: Schema without data
   - **Data Only**: Data without schema
   - **Structure and Data**: Complete backup
4. Select compression and format options

### Command Line Backup

```bash
# Full database backup
mysqldump -u username -p database_name > backup.sql

# Compressed backup
mysqldump -u username -p database_name | gzip > backup.sql.gz

# Specific tables
mysqldump -u username -p database_name table1 table2 > tables_backup.sql
```

### Restoring Backups

1. Right-click target database
2. Select "Import" → "MySQL Dump"
3. Choose backup file
4. Configure import options
5. Monitor progress

### Command Line Restore

```bash
# Restore from backup
mysql -u username -p database_name < backup.sql

# Restore compressed backup
gunzip < backup.sql.gz | mysql -u username -p database_name
```

## User Management

### Creating Users

```sql
-- Create new user
CREATE USER 'newuser'@'localhost' IDENTIFIED BY 'password';

-- Grant privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON database.* TO 'newuser'@'localhost';

-- Grant all privileges
GRANT ALL PRIVILEGES ON database.* TO 'newuser'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;
```

### Managing Privileges

```sql
-- Show user privileges
SHOW GRANTS FOR 'username'@'host';

-- Revoke privileges
REVOKE INSERT ON database.* FROM 'username'@'host';

-- Drop user
DROP USER 'username'@'host';
```

## Monitoring and Maintenance

### Performance Monitoring

Use the built-in monitoring dashboard to track:
- Connection count
- Query execution times
- Slow query log
- Resource usage

### Regular Maintenance

**Optimize Tables**:
```sql
OPTIMIZE TABLE table_name;
```

**Analyze Tables**:
```sql
ANALYZE TABLE table_name;
```

**Check Tables**:
```sql
CHECK TABLE table_name;
```

**Repair Tables** (MyISAM only):
```sql
REPAIR TABLE table_name;
```

## Troubleshooting

### Performance Issues

**Slow Queries**:
1. Enable slow query log
2. Use EXPLAIN to analyze queries
3. Check for missing indexes
4. Review query structure

**High CPU Usage**:
1. Identify expensive queries
2. Check for table locks
3. Review concurrent connections
4. Optimize database configuration

### Storage Issues

**Disk Space**:
1. Monitor database size growth
2. Archive old data
3. Optimize table storage
4. Consider partitioning large tables

**InnoDB Issues**:
1. Monitor InnoDB buffer pool
2. Check for deadlocks
3. Optimize InnoDB settings
4. Review transaction isolation levels

## Best Practices

### Security
- Use strong passwords
- Limit user privileges
- Enable SSL for remote connections
- Regular security updates
- Monitor access logs

### Performance
- Regular maintenance tasks
- Monitor slow queries
- Optimize indexes
- Use appropriate storage engines
- Configure buffer pools properly

### Backup Strategy
- Regular automated backups
- Test restore procedures
- Store backups securely
- Document recovery procedures
- Monitor backup success

## Additional Resources

- [MySQL Official Documentation](https://dev.mysql.com/doc/)
- [MariaDB Documentation](https://mariadb.com/kb/en/)
- [MySQL Performance Tuning](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [MariaDB Performance](https://mariadb.com/kb/en/optimization-and-tuning/)

For Multi-Database Manager specific issues, contact our support team.
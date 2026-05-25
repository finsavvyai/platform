# PostgreSQL Setup Tutorial

This tutorial will guide you through connecting to PostgreSQL databases using the Multi-Database Manager.

## Prerequisites

- PostgreSQL server (local or remote)
- Database credentials (username/password)
- Network access to the database server

## Connection Setup

### Step 1: Open Connection Dialog

1. Launch Multi-Database Manager
2. Click "New Connection" in the toolbar or press `Cmd+N`
3. Select "PostgreSQL" from the database type dropdown

### Step 2: Configure Connection Parameters

Fill in the following fields:

- **Connection Name**: Give your connection a descriptive name (e.g., "Production DB")
- **Host**: PostgreSQL server address
  - Local: `localhost` or `127.0.0.1`
  - Remote: IP address or hostname
- **Port**: Default is `5432` (change if using custom port)
- **Database**: Target database name
- **Username**: PostgreSQL username
- **Password**: User password (stored securely in Keychain)

### Step 3: Advanced Settings (Optional)

Click "Advanced" to configure:

- **SSL Mode**: Choose from disable, allow, prefer, require, verify-ca, verify-full
- **Connection Timeout**: Timeout in seconds (default: 30)
- **Application Name**: Identifier for this connection in PostgreSQL logs
- **Search Path**: Default schema search path

### Step 4: Test Connection

1. Click "Test Connection" button
2. Wait for the connection test to complete
3. Green checkmark indicates successful connection
4. Red X indicates connection failure - check error message

### Common Connection Issues

#### Issue: "Connection refused"
**Cause**: PostgreSQL server not running or wrong host/port
**Solution**: 
- Verify PostgreSQL service is running
- Check host and port settings
- Ensure firewall allows connections

#### Issue: "Authentication failed"
**Cause**: Incorrect username or password
**Solution**:
- Verify credentials with database administrator
- Check if user exists: `SELECT * FROM pg_user WHERE usename = 'your_username';`

#### Issue: "Database does not exist"
**Cause**: Specified database name doesn't exist
**Solution**:
- List available databases: `\l` in psql
- Create database if needed: `CREATE DATABASE your_database;`

## Docker PostgreSQL Setup

### Quick Start with Docker

1. Open Docker panel in Multi-Database Manager
2. Click "New Container"
3. Select "PostgreSQL" template
4. Configure settings:
   - **Container Name**: `postgres-dev`
   - **Port**: `5432` (or custom port)
   - **Database Name**: `postgres`
   - **Username**: `postgres`
   - **Password**: Choose secure password
5. Click "Create Container"

### Manual Docker Setup

If you prefer command line:

```bash
docker run --name postgres-dev \
  -e POSTGRES_DB=mydb \
  -e POSTGRES_USER=myuser \
  -e POSTGRES_PASSWORD=mypassword \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  -d postgres:15
```

Then connect using:
- Host: `localhost`
- Port: `5432`
- Database: `mydb`
- Username: `myuser`
- Password: `mypassword`

## Cloud PostgreSQL Setup

### AWS RDS

1. Get connection details from AWS Console:
   - Endpoint (host)
   - Port (usually 5432)
   - Database name
   - Master username
2. Ensure security group allows your IP
3. Use endpoint as host in connection dialog

### Google Cloud SQL

1. Get connection details from Google Cloud Console:
   - Public IP address
   - Database name
   - Username and password
2. Add your IP to authorized networks
3. Enable SSL if required

### Azure Database for PostgreSQL

1. Get connection details from Azure Portal:
   - Server name (host)
   - Database name
   - Admin username
2. Configure firewall rules
3. Use SSL connection (required by Azure)

## SSL Configuration

### Enabling SSL

1. In connection dialog, click "Advanced"
2. Set SSL Mode to "require" or higher
3. For self-signed certificates, use "require"
4. For CA-signed certificates, use "verify-full"

### SSL Certificates

If using custom certificates:

1. Download server certificate files
2. In Advanced settings, specify:
   - **SSL Certificate**: Client certificate file
   - **SSL Key**: Client private key file
   - **SSL Root Certificate**: CA certificate file

## Performance Optimization

### Connection Pooling

For high-traffic applications:

1. Enable connection pooling in Advanced settings
2. Set appropriate pool size (default: 5)
3. Configure pool timeout settings

### Query Optimization

Use the built-in query analyzer:

1. Execute your query
2. Click "Explain Plan" button
3. Review execution plan
4. Follow optimization suggestions

## Backup and Restore

### Creating Backups

1. Right-click database in schema browser
2. Select "Export" → "Database Dump"
3. Choose format:
   - **Custom**: PostgreSQL custom format (recommended)
   - **SQL**: Plain SQL statements
   - **Tar**: Tar archive format
4. Select backup options and location

### Restoring Backups

1. Right-click target database
2. Select "Import" → "Database Dump"
3. Choose backup file
4. Configure restore options
5. Monitor progress in import dialog

## Troubleshooting

### Performance Issues

**Slow Queries**:
1. Use EXPLAIN ANALYZE to identify bottlenecks
2. Check for missing indexes
3. Review query execution plan
4. Consider query rewriting

**Connection Timeouts**:
1. Increase connection timeout in Advanced settings
2. Check network latency
3. Verify server load and resources

### Security Issues

**SSL Errors**:
1. Verify SSL certificate validity
2. Check certificate chain
3. Ensure proper SSL mode setting
4. Contact database administrator

**Permission Denied**:
1. Verify user has required privileges
2. Check database and schema permissions
3. Review pg_hba.conf settings on server

## Best Practices

### Security
- Always use SSL for remote connections
- Use strong passwords
- Limit user privileges to minimum required
- Regularly rotate passwords

### Performance
- Use connection pooling for multiple connections
- Monitor query performance regularly
- Keep statistics up to date
- Regular VACUUM and ANALYZE operations

### Maintenance
- Regular backups (automated if possible)
- Monitor disk space usage
- Keep PostgreSQL updated
- Review and optimize slow queries

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL Performance Tips](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [SSL Configuration Guide](https://www.postgresql.org/docs/current/ssl-tcp.html)

For specific issues with Multi-Database Manager, contact our support team.
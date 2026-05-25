# QueryFlux DBA Features Documentation

Complete Database Administrator functionality for enterprise-grade database management.

---

## 🛠️ DBA Components Overview

### 1. **Backup Manager** (`BackupManager.tsx`)

Complete backup and restore solution with scheduling capabilities.

#### Features:
- ✅ **Create Backups**
  - Full backups (complete database)
  - Incremental backups (changes since last backup)
  - Differential backups (changes since last full backup)
  - Schema-only or data-only backups
  - Compression support
  - Custom table selection

- ✅ **Restore Backups**
  - Point-in-time recovery
  - Selective table restore
  - Target database selection
  - Overwrite protection

- ✅ **Scheduled Backups**
  - Hourly, daily, weekly, monthly frequencies
  - Custom time scheduling
  - Automatic retention policies
  - Email notifications (ready for integration)

- ✅ **Backup Management**
  - View backup history
  - Size and duration tracking
  - Status monitoring (completed, failed, in-progress)
  - Delete old backups

#### Usage Example:
```typescript
<BackupManager
  backups={backupHistory}
  databases={['production', 'staging']}
  onCreateBackup={async (config) => {
    await createDatabaseBackup(config);
  }}
  onRestoreBackup={async (backupId, options) => {
    await restoreFromBackup(backupId, options);
  }}
  onScheduleBackup={async (schedule) => {
    await scheduleAutomatedBackup(schedule);
  }}
/>
```

---

### 2. **User & Role Manager** (`UserRoleManager.tsx`)

Enterprise user and permission management system.

#### Features:
- ✅ **User Management**
  - Create/delete database users
  - Set connection limits
  - Account expiration dates
  - Login enable/disable
  - Superuser privileges
  - Database creation rights
  - Role creation rights
  - Replication privileges
  - Bypass Row Level Security (RLS)

- ✅ **Role Management**
  - Create custom roles
  - Assign members to roles
  - Role inheritance
  - Role descriptions
  - Login-capable roles

- ✅ **Privilege Management**
  - Grant/revoke privileges
  - Table-level permissions (SELECT, INSERT, UPDATE, DELETE)
  - Schema-level permissions
  - Database-level permissions
  - Grantable permissions
  - Privilege tracking

#### Supported Privileges:
- SELECT - Read data
- INSERT - Add new rows
- UPDATE - Modify existing rows
- DELETE - Remove rows
- TRUNCATE - Delete all rows
- REFERENCES - Create foreign keys
- TRIGGER - Create triggers
- ALL - All privileges

#### Usage Example:
```typescript
<UserRoleManager
  users={databaseUsers}
  roles={databaseRoles}
  databases={['app_db', 'analytics_db']}
  onCreateUser={async (user) => {
    await createDatabaseUser(user);
  }}
  onCreateRole={async (role) => {
    await createDatabaseRole(role);
  }}
  onGrantPrivilege={async (roleId, privilege) => {
    await grantPrivilege(roleId, privilege);
  }}
/>
```

---

### 3. **Connection Pool Monitor** (`ConnectionPoolMonitor.tsx`)

Real-time connection pool and session monitoring.

#### Features:
- ✅ **Pool Statistics**
  - Total connections
  - Active connections
  - Idle connections
  - Waiting clients
  - Max connection limits
  - Utilization percentage
  - Average wait time
  - Longest wait time
  - Error tracking
  - Uptime monitoring

- ✅ **Active Connections**
  - Process ID (PID)
  - Username and database
  - Client address
  - Application name
  - Connection state (active, idle, waiting)
  - Current query
  - Duration
  - Wait events

- ✅ **Connection Actions**
  - Kill/terminate connections
  - Real-time refresh
  - Connection filtering

#### Connection States:
- **Active** - Currently executing a query
- **Idle** - Connected but not running queries
- **Idle in Transaction** - In a transaction but not active
- **Waiting** - Waiting for a lock or resource

#### Usage Example:
```typescript
<ConnectionPoolMonitor
  poolStats={poolStatistics}
  connections={activeConnections}
  onKillConnection={async (pid) => {
    await terminateConnection(pid);
  }}
  onRefresh={async () => {
    await refreshConnectionData();
  }}
/>
```

---

### 4. **Query Performance Analyzer** (`QueryPerformanceAnalyzer.tsx`)

Advanced query analysis and optimization tool.

#### Features:
- ✅ **Query Statistics**
  - Execution count
  - Total time
  - Mean/average time
  - Min/max execution time
  - Standard deviation
  - Row counts
  - Cache hit ratio
  - Disk I/O statistics
  - Temporary storage usage

- ✅ **Slow Query Log**
  - Queries exceeding threshold
  - Duration tracking
  - User and database context
  - Timestamp logging
  - Rows affected

- ✅ **EXPLAIN Analyzer**
  - Query execution plans
  - Planning time
  - Execution time
  - Total cost estimation
  - Row count estimates vs actual
  - Node type analysis
  - Performance warnings
  - Optimization recommendations

#### Performance Ratings:
- **Excellent** - < 10ms
- **Good** - 10-100ms
- **Fair** - 100-1000ms
- **Poor** - > 1000ms

#### Cache Hit Recommendations:
- **Good** - > 90% cache hit ratio
- **Warning** - 70-90% cache hit ratio
- **Critical** - < 70% cache hit ratio

#### Usage Example:
```typescript
<QueryPerformanceAnalyzer
  queryStats={queryStatistics}
  slowQueries={slowQueryLog}
  onExplainQuery={async (query) => {
    const plan = await explainAnalyze(query);
    return plan;
  }}
  onOptimizeQuery={async (query) => {
    const optimized = await suggestOptimizations(query);
    return optimized;
  }}
/>
```

---

### 5. **Table Maintenance** (`TableMaintenance.tsx`)

Comprehensive table maintenance and optimization.

#### Features:
- ✅ **Maintenance Operations**
  - **VACUUM** - Reclaim dead tuple space
  - **VACUUM FULL** - Complete table rebuild
  - **ANALYZE** - Update table statistics
  - **REINDEX** - Rebuild all indexes
  - **CLUSTER** - Physically reorder table
  - **TRUNCATE** - Delete all data (with confirmation)

- ✅ **Table Health Monitoring**
  - Table size tracking
  - Row count
  - Dead tuple count
  - Bloat ratio percentage
  - Index sizes
  - Last maintenance timestamps
  - Auto-vacuum tracking

- ✅ **Health Indicators**
  - Bloat levels (Healthy < 10%, Warning < 30%, Critical > 30%)
  - Dead tuple warnings
  - Maintenance recommendations
  - Visual alerts for tables needing attention

#### When to Use Each Operation:

**VACUUM**
- Regular maintenance (daily/weekly)
- Reclaims space from dead tuples
- Doesn't lock table for reads/writes
- Fast and non-blocking

**VACUUM FULL**
- Extreme bloat (> 50%)
- Reclaims maximum space
- **WARNING**: Locks table completely
- Can take hours on large tables
- Only use during maintenance windows

**ANALYZE**
- After significant data changes
- Updates query planner statistics
- Fast and lightweight
- Should run frequently

**REINDEX**
- Index bloat or corruption
- After VACUUM FULL
- Improves index performance
- Locks table for writes

**CLUSTER**
- Physically reorder table by index
- Improves sequential scan performance
- **WARNING**: Locks table completely
- One-time operation (doesn't auto-maintain)

**TRUNCATE**
- Delete all data instantly
- Much faster than DELETE
- **WARNING**: Cannot be undone
- Resets sequences

#### Usage Example:
```typescript
<TableMaintenance
  tables={tableHealthData}
  operations={maintenanceHistory}
  onVacuum={async (schema, table, full) => {
    await vacuumTable(schema, table, full);
  }}
  onAnalyze={async (schema, table) => {
    await analyzeTable(schema, table);
  }}
  onReindex={async (schema, table) => {
    await reindexTable(schema, table);
  }}
/>
```

---

## 🎯 DBA Best Practices

### Backup Strategy
1. **Full backups weekly** (e.g., Sunday night)
2. **Incremental backups daily** (faster, less space)
3. **Test restores monthly** (verify backup integrity)
4. **Store offsite** (3-2-1 rule: 3 copies, 2 media types, 1 offsite)
5. **Document procedures** (restoration steps)

### User Management
1. **Principle of least privilege** (only grant necessary permissions)
2. **Use roles** (easier to manage than individual users)
3. **Regular audits** (review user permissions quarterly)
4. **Connection limits** (prevent runaway connections)
5. **Expiration dates** (for temporary access)

### Connection Management
1. **Monitor pool utilization** (alert at 80%)
2. **Set appropriate max connections** (typically CPU cores × 2-4)
3. **Kill long-running queries** (set statement timeout)
4. **Watch for idle in transaction** (potential locks)
5. **Use connection pooling** (PgBouncer, pgpool)

### Query Optimization
1. **Monitor slow queries** (> 1 second threshold)
2. **Check EXPLAIN plans** (look for seq scans on large tables)
3. **Maintain statistics** (run ANALYZE regularly)
4. **Create indexes** (but not too many!)
5. **Cache hit ratio** (aim for > 95%)

### Table Maintenance
1. **VACUUM daily** (during low-traffic hours)
2. **ANALYZE after bulk changes** (updates statistics)
3. **Monitor bloat** (VACUUM FULL if > 50%)
4. **REINDEX quarterly** (or when performance degrades)
5. **Set autovacuum** (configure thresholds appropriately)

---

## 📊 Monitoring Metrics

### Critical Metrics to Watch
- Connection pool utilization (> 80% = warning)
- Cache hit ratio (< 90% = investigate)
- Slow query count (increasing trend = problem)
- Table bloat ratio (> 30% = maintenance needed)
- Dead tuple count (> 10% of rows = vacuum needed)
- Index usage (unused indexes = remove them)

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Connection Utilization | 70% | 90% |
| Cache Hit Ratio | 85% | 70% |
| Query Duration | 1s | 5s |
| Table Bloat | 20% | 40% |
| Dead Tuples | 10% | 25% |

---

## 🔒 Security Considerations

### User Security
- **Never use superuser for applications**
- **One user per application/service**
- **Rotate passwords regularly** (90 days)
- **Audit user activity** (enable logging)
- **Revoke unused permissions**

### Connection Security
- **Use SSL/TLS** (encrypted connections)
- **IP whitelisting** (restrict client addresses)
- **Connection timeouts** (prevent abandoned connections)
- **Rate limiting** (prevent brute force)

### Backup Security
- **Encrypt backups** (especially offsite)
- **Restrict backup access** (only DBA team)
- **Verify integrity** (checksums)
- **Test restores** (in isolated environment)

---

## 🚀 Performance Tuning

### Query Optimization
1. Add indexes for frequently queried columns
2. Use partial indexes for filtered queries
3. Consider covering indexes (include columns)
4. Avoid SELECT * (specify columns)
5. Use EXPLAIN ANALYZE (verify plans)

### Connection Pooling
1. PgBouncer for transaction pooling
2. Pool size = (CPU cores × 2) + effective_spindle_count
3. Monitor wait times
4. Set idle timeout
5. Use prepared statements

### Vacuum Tuning
```sql
-- Adjust autovacuum settings
ALTER TABLE large_table SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.01
);
```

---

## 📝 Maintenance Schedules

### Daily
- Monitor connection pool
- Check slow query log
- Review error logs
- Monitor disk space

### Weekly
- VACUUM all tables
- ANALYZE statistics
- Review table bloat
- Check backup success

### Monthly
- Test backup restore
- Review user permissions
- REINDEX if needed
- Update statistics
- Review query performance

### Quarterly
- Full system audit
- Review and optimize indexes
- Database cleanup (old data)
- Update documentation
- Disaster recovery test

---

## 🎓 Training & Resources

### PostgreSQL Documentation
- [Performance Tips](https://www.postgresql.org/docs/current/performance-tips.html)
- [Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html)
- [Monitoring Activity](https://www.postgresql.org/docs/current/monitoring-stats.html)

### Recommended Tools
- **pgAdmin** - GUI administration
- **PgBouncer** - Connection pooling
- **pg_stat_statements** - Query statistics
- **pgBadger** - Log analyzer
- **pg_repack** - Online table reorganization

---

**Built for Enterprise Database Management**

*QueryFlux DBA Tools - Professional Database Administration Made Easy*

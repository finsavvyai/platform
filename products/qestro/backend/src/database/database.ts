/**
 * Database re-export for backwards compatibility
 * Services should import from '../lib/db.js' but many use '../database/database.js'
 */

export { db, connection, checkDatabaseHealth, getDatabaseMetrics, closeDatabaseConnection, reconnectDatabase, startConnectionMonitoring, stopConnectionMonitoring, createDatabasePool } from '../lib/db.js';
export { default } from '../lib/db.js';

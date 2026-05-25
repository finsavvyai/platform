// Bridge: re-export from the canonical lib/db module
export {
  db,
  checkDatabaseHealth,
  closeDatabaseConnection,
  getDatabaseMetrics
} from '../lib/db.js';

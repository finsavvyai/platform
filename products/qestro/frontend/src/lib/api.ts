// Backward-compatible re-export from refactored API modules.
// All existing `import { api } from '../lib/api'` statements
// continue to work without changes.
export { api } from './api/index';
export type { QestroAPI } from './api/index';

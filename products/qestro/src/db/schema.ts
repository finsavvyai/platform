/**
 * Database schema re-export for Workers compatibility
 * Exports all schema definitions from the main schema directory
 */

// Export the main schema object and all its contents
export { schema, schemaMetadata } from '../schema/index';
export * from '../schema/core-schema';
export * from '../schema/test-execution-schema';
export * from '../schema/api-management-schema';
export * from '../schema/plugin-system-schema';
export * from '../schema/voice-system-schema';
export * from '../schema/advanced-analytics-schema';
export * from '../schema/payment-system-schema';
export * from '../schema/platform-schema';

// Default export for import * as schema usage
import { schema } from '../schema/index';
export default schema;

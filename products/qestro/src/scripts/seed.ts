#!/usr/bin/env node

/**
 * Questro Database Seeding Script
 *
 * Usage:
 *   npm run seed:dev              # Seed development data
 *   npm run seed:dev -- --clear   # Clear existing data and seed fresh
 *   npm run seed:prod             # Seed production data (limited)
 */

import { program } from 'commander';
import { seedDevelopmentData } from './seed-development-data';

interface SeedOptions {
  clear?: boolean;
  environment?: string;
}

async function main(): Promise<void> {
  program
    .name('questro-seeder')
    .description('Questro database seeding tool')
    .version('1.0.0');

  program
    .command('seed')
    .description('Seed database with development data')
    .option('-c, --clear', 'Clear existing data before seeding')
    .option('-e, --environment <env>', 'Target environment', 'development')
    .action(async (options: SeedOptions) => {
      try {
        console.log(`🚀 Starting database seeding for ${options.environment} environment...`);

        if (options.environment === 'production') {
          console.log('⚠️  Production seeding is limited to safety-critical data only');
          // TODO: Implement production-safe seeding
          console.log('🚧 Production seeding not yet implemented');
          return;
        }

        // Initialize D1 database
        // Note: In a real implementation, you would get the D1 database from environment
        const d1Database = getD1Database();

        await seedDevelopmentData(d1Database, { clear: options.clear });

        console.log('🎉 Database seeding completed successfully!');

      } catch (error) {
        console.error('❌ Database seeding failed:', error);
        process.exit(1);
      }
    });

  program
    .command('clear')
    .description('Clear all data from database')
    .option('-e, --environment <env>', 'Target environment', 'development')
    .option('--confirm', 'Confirm database clearing')
    .action(async (options: { environment?: string; confirm?: boolean }) => {
      try {
        if (!options.confirm) {
          console.error('❌ Please use --confirm to clear all database data');
          console.log('   Example: npm run seed:clear -- --confirm');
          process.exit(1);
        }

        if (options.environment === 'production') {
          console.error('❌ Cannot clear production database for safety reasons');
          process.exit(1);
        }

        console.log('🧹 Clearing database...');

        const d1Database = getD1Database();
        const { DataSeeder } = await import('./seed-development-data');
        const seeder = new DataSeeder(d1Database);

        await seeder.clearAll();

        console.log('✅ Database cleared successfully!');

      } catch (error) {
        console.error('❌ Database clearing failed:', error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

/**
 * Get D1 database instance
 * This would be replaced with actual D1 database initialization in your environment
 */
function getD1Database(): D1Database {
  // In a real implementation, this would initialize the actual D1 database
  // For now, we'll create a mock that would work in the Workers environment

  if (typeof globalThis.D1Database !== 'undefined') {
    // Running in Cloudflare Workers environment
    return globalThis.D1Database;
  }

  // For local development, you might use a local SQLite database
  // or connect to a remote D1 database via the API
  throw new Error('D1 database not available. Please run in Cloudflare Workers environment or configure D1 connection.');
}

// Export for use in Workers
export { DataSeeder } from './seed-development-data';

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

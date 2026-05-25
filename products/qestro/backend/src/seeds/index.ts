import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { seedUsers } from './users.js';
import { seedPluginCategories } from './pluginCategories.js';
import { seedPluginTags } from './pluginTags.js';
import { seedVoiceCommands } from './voiceCommands.js';
import { seedPlugins } from './plugins.js';
import { seedDataSources } from './dataSources.js';
import { seedApiTestCases } from './apiTestCases.js';
import { seedDatabaseTestCases } from './databaseTestCases.js';
import { seedTestExecutionEnvironments } from './testExecutionEnvironments.js';
import * as schema from '../schema/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const getDatabaseUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production';
  const useSupabase = process.env.USE_SUPABASE === 'true' || isProduction;

  if (useSupabase) {
    const host = process.env.SUPABASE_DB_HOST || 'localhost';
    const port = process.env.SUPABASE_DB_PORT || '5432';
    const database = process.env.SUPABASE_DB_NAME || 'postgres';
    const username = process.env.SUPABASE_DB_USER || 'postgres';
    const password = process.env.SUPABASE_DB_PASSWORD;
    
    if (!password) {
      throw new Error('SUPABASE_DB_PASSWORD environment variable is required');
    }
    
    const sslSuffix = isProduction ? '?sslmode=require' : '';
    return `postgresql://${username}:${password}@${host}:${port}/${database}${sslSuffix}`;
  }
  
  // Local database configuration
  const host = process.env.LOCAL_DB_HOST || 'localhost';
  const port = process.env.LOCAL_DB_PORT || '5432';
  const database = process.env.LOCAL_DB_NAME || 'testflow_pro';
  const username = process.env.LOCAL_DB_USER || 'postgres';
  const password = process.env.LOCAL_DB_PASSWORD || 'postgres';
  
  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
};

async function seed() {
  const connectionString = getDatabaseUrl();
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('🌱 Starting database seeding...');

  try {
    // Seed in order of dependencies
    console.log('👥 Seeding users...');
    const users = await seedUsers(db);

    console.log('🏷️ Seeding plugin categories...');
    await seedPluginCategories(db);

    console.log('🏷️ Seeding plugin tags...');
    await seedPluginTags(db);

    console.log('🎤 Seeding voice commands...');
    await seedVoiceCommands(db);

    console.log('🔌 Seeding plugins...');
    const plugins = await seedPlugins(db, users);

    console.log('🗃️ Seeding data sources...');
    const dataSources = await seedDataSources(db, users);

    // Create some sample projects for testing
    console.log('📁 Creating sample projects...');
    const sampleProjects = await db.insert(schema.projects).values([
      {
        userId: users[0].id,
        name: 'E-commerce Web App',
        description: 'Testing suite for e-commerce web application',
        type: 'web',
        platform: 'chrome',
        settings: {
          baseUrl: 'https://demo-ecommerce.questro.com',
          defaultTimeout: 30000,
          screenshotOnFailure: true
        }
      },
      {
        userId: users[1]?.id || users[0].id,
        name: 'Mobile Banking App',
        description: 'Mobile testing for banking application',
        type: 'mobile',
        platform: 'ios',
        settings: {
          appId: 'com.questro.banking',
          deviceType: 'iPhone 14',
          orientation: 'portrait'
        }
      }
    ]).returning();

    console.log('🌐 Seeding test execution environments...');
    await seedTestExecutionEnvironments(db, users, sampleProjects);

    console.log('🔗 Seeding API test cases...');
    await seedApiTestCases(db, users, sampleProjects);

    console.log('🗄️ Seeding database test cases...');
    await seedDatabaseTestCases(db, users, sampleProjects, dataSources);

    console.log('✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}

export { seed };
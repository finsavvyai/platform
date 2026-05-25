import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { pluginCategories } from '../schema/index.js';

export async function seedPluginCategories(db: PostgresJsDatabase<any>) {
  const categories = [
    {
      name: 'Test Generators',
      slug: 'test-generators',
      description: 'Plugins that generate test cases and test scripts',
      icon: 'code',
      color: '#3B82F6',
      sortOrder: 1,
    },
    {
      name: 'Validators',
      slug: 'validators',
      description: 'Plugins that validate test results and data integrity',
      icon: 'check-circle',
      color: '#10B981',
      sortOrder: 2,
    },
    {
      name: 'Integrations',
      slug: 'integrations',
      description: 'Plugins that integrate with external services and tools',
      icon: 'link',
      color: '#8B5CF6',
      sortOrder: 3,
    },
    {
      name: 'Reporters',
      slug: 'reporters',
      description: 'Plugins that generate reports and analytics',
      icon: 'chart-bar',
      color: '#F59E0B',
      sortOrder: 4,
    },
    {
      name: 'Data Providers',
      slug: 'data-providers',
      description: 'Plugins that provide test data and mock services',
      icon: 'database',
      color: '#EF4444',
      sortOrder: 5,
    },
    {
      name: 'AI & Machine Learning',
      slug: 'ai-ml',
      description: 'AI-powered plugins for intelligent testing',
      icon: 'brain',
      color: '#06B6D4',
      sortOrder: 6,
    },
    {
      name: 'Performance Testing',
      slug: 'performance',
      description: 'Plugins for load testing and performance analysis',
      icon: 'lightning-bolt',
      color: '#F97316',
      sortOrder: 7,
    },
    {
      name: 'Security Testing',
      slug: 'security',
      description: 'Plugins for security testing and vulnerability scanning',
      icon: 'shield-check',
      color: '#DC2626',
      sortOrder: 8,
    },
  ];

  const insertedCategories = await db.insert(pluginCategories).values(categories).returning();
  console.log(`✅ Inserted ${insertedCategories.length} plugin categories`);
  
  return insertedCategories;
}
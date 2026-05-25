import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { pluginTags } from '../schema/index.js';

export async function seedPluginTags(db: PostgresJsDatabase<any>) {
  const tags = [
    { name: 'web', slug: 'web', description: 'Web application testing', color: '#3B82F6' },
    { name: 'mobile', slug: 'mobile', description: 'Mobile application testing', color: '#10B981' },
    { name: 'api', slug: 'api', description: 'API testing and validation', color: '#8B5CF6' },
    { name: 'database', slug: 'database', description: 'Database testing', color: '#F59E0B' },
    { name: 'e2e', slug: 'e2e', description: 'End-to-end testing', color: '#EF4444' },
    { name: 'unit', slug: 'unit', description: 'Unit testing', color: '#06B6D4' },
    { name: 'integration', slug: 'integration', description: 'Integration testing', color: '#F97316' },
    { name: 'performance', slug: 'performance', description: 'Performance testing', color: '#DC2626' },
    { name: 'security', slug: 'security', description: 'Security testing', color: '#7C3AED' },
    { name: 'accessibility', slug: 'accessibility', description: 'Accessibility testing', color: '#059669' },
    { name: 'visual', slug: 'visual', description: 'Visual regression testing', color: '#D97706' },
    { name: 'cross-browser', slug: 'cross-browser', description: 'Cross-browser testing', color: '#B91C1C' },
    { name: 'automation', slug: 'automation', description: 'Test automation', color: '#7C2D12' },
    { name: 'ci-cd', slug: 'ci-cd', description: 'CI/CD integration', color: '#365314' },
    { name: 'reporting', slug: 'reporting', description: 'Test reporting', color: '#1E3A8A' },
    { name: 'analytics', slug: 'analytics', description: 'Test analytics', color: '#701A75' },
    { name: 'ai', slug: 'ai', description: 'AI-powered testing', color: '#BE185D' },
    { name: 'voice', slug: 'voice', description: 'Voice-controlled testing', color: '#9333EA' },
    { name: 'cloud', slug: 'cloud', description: 'Cloud testing services', color: '#0369A1' },
    { name: 'open-source', slug: 'open-source', description: 'Open source plugins', color: '#166534' },
  ];

  const insertedTags = await db.insert(pluginTags).values(tags).returning();
  console.log(`✅ Inserted ${insertedTags.length} plugin tags`);
  
  return insertedTags;
}
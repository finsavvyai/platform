/**
 * Code Generation — supported languages, frameworks, and templates
 */

export const SUPPORTED_LANGUAGES = {
  typescript: { name: 'TypeScript', frameworks: ['prisma', 'typeOrm', 'sequelize', 'mikroOrm', 'raw'], extensions: ['.ts', '.tsx'] },
  python: { name: 'Python', frameworks: ['sqlalchemy', 'django', 'fastapi', 'pydantic', 'raw'], extensions: ['.py'] },
  go: { name: 'Go', frameworks: ['gorm', 'sqlx', 'sqlc', 'raw'], extensions: ['.go'] },
  java: { name: 'Java', frameworks: ['hibernate', 'spring-jpa', 'jooq', 'raw'], extensions: ['.java'] },
  rust: { name: 'Rust', frameworks: ['diesel', 'sqlx', 'sea-orm', 'raw'], extensions: ['.rs'] },
  csharp: { name: 'C#', frameworks: ['entity-framework', 'dapper', 'raw'], extensions: ['.cs'] },
  php: { name: 'PHP', frameworks: ['laravel', 'doctrine', 'raw'], extensions: ['.php'] },
  ruby: { name: 'Ruby', frameworks: ['rails', 'sequel', 'raw'], extensions: ['.rb'] },
} as const;

export const SUPPORTED_TEMPLATES = {
  orm_models: { name: 'ORM Models', description: 'Generate ORM model classes for all tables', icon: '📦' },
  rest_api: { name: 'REST API', description: 'Generate complete REST API with handlers', icon: '🌐' },
  crud: { name: 'CRUD Operations', description: 'Generate CRUD operations for each table', icon: '⚙️' },
  repository: { name: 'Repository Pattern', description: 'Generate repository pattern implementation', icon: '🗄️' },
  dto: { name: 'DTOs & Mappers', description: 'Generate data transfer objects and mappers', icon: '📝' },
  validation: { name: 'Validation Schemas', description: 'Generate validation schemas for each model', icon: '✅' },
} as const;

export type Language = keyof typeof SUPPORTED_LANGUAGES;
export type Framework = typeof SUPPORTED_LANGUAGES[Language]['frameworks'][number];
export type Template = keyof typeof SUPPORTED_TEMPLATES;

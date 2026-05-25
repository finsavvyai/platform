import type { Config } from 'drizzle-kit';

export default {
	dialect: 'sqlite',
	schema: './drizzle/schema/index.ts',
	out: './drizzle/migrations',
	driver: 'd1-http',
	dbCredentials: {
		wranglerConfigPath: './wrangler.toml',
		dbName: 'tenantiq-db',
	},
} satisfies Config;

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

/**
 * Create a Drizzle ORM database instance using Neon's HTTP driver.
 * Works in Cloudflare Workers (no TCP sockets needed).
 */
export function createDb(connectionString: string) {
	const sql = neon(connectionString);
	return drizzle(sql);
}

/**
 * Create a Drizzle ORM database instance for Cloudflare Workers with Hyperdrive.
 * Hyperdrive provides a connection string via env.HYPERDRIVE.connectionString.
 */
export function createDbFromHyperdrive(hyperdrive: { connectionString: string }) {
	const sql = neon(hyperdrive.connectionString);
	return drizzle(sql);
}

/**
 * Shared DB type across runtimes.
 * TenantIQ currently uses both Neon and D1 adapters in different modules.
 */
export type Database = ReturnType<typeof createDb> | { [key: string]: any };

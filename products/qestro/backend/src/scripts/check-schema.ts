import db from '../lib/db.js';
import { sql } from 'drizzle-orm';

async function checkSchema() {
    try {
        const result = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
        console.log('Users table columns:');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkSchema();

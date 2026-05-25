import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { users } from '../schema/index.js';
import bcrypt from 'bcryptjs';

export async function seedUsers(db: PostgresJsDatabase<any>) {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const seedUsers = [
    {
      email: 'admin@qestro.app',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      subscription: 'enterprise',
      isEmailVerified: true,
    },
    {
      email: 'developer@qestro.app',
      password: hashedPassword,
      firstName: 'Plugin',
      lastName: 'Developer',
      role: 'user',
      subscription: 'pro',
      isEmailVerified: true,
    },
    {
      email: 'tester@qestro.app',
      password: hashedPassword,
      firstName: 'QA',
      lastName: 'Tester',
      role: 'user',
      subscription: 'free',
      isEmailVerified: true,
    },
  ];

  const insertedUsers = await db.insert(users).values(seedUsers).returning();
  console.log(`✅ Inserted ${insertedUsers.length} users`);
  
  return insertedUsers;
}
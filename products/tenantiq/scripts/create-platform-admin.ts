/**
 * Create Platform Admin User
 *
 * This script creates the first platform admin user who can manage customer organizations.
 */

import { nanoid } from 'nanoid';
import * as bcrypt from 'bcryptjs';

interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin';
  passwordHash: string;
  status: 'active';
  emailVerified: number;
  authProvider: 'email';
  createdAt: string;
  updatedAt: string;
}

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function createPlatformAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@tenantiq.com';
  const name = process.env.ADMIN_NAME || 'Platform Admin';
  const password = process.env.ADMIN_PASSWORD || 'TenantIQ2026!Admin';

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  const admin: PlatformAdmin = {
    id: nanoid(),
    email,
    name,
    role: 'platform_admin',
    passwordHash,
    status: 'active',
    emailVerified: 1,
    authProvider: 'email',
    createdAt: now,
    updatedAt: now,
  };

  // Generate SQL INSERT statement
  const sql = `
INSERT INTO platform_users (
  id, organization_id, email, name, role, password_hash,
  status, email_verified, auth_provider, created_at, updated_at
) VALUES (
  '${admin.id}',
  NULL,
  '${admin.email}',
  '${admin.name}',
  '${admin.role}',
  '${admin.passwordHash}',
  '${admin.status}',
  ${admin.emailVerified},
  '${admin.authProvider}',
  '${admin.createdAt}',
  '${admin.updatedAt}'
);`.trim();

  console.log('Platform Admin Details:');
  console.log('========================');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Name: ${name}`);
  console.log('');
  console.log('SQL Command:');
  console.log('============');
  console.log(sql);
  console.log('');
  console.log('IMPORTANT: Save these credentials securely!');

  return sql;
}

createPlatformAdmin().catch(console.error);

/**
 * Create Platform Admin User
 */

import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

async function createPlatformAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@tenantiq.com';
  const name = process.env.ADMIN_NAME || 'Platform Admin';
  const password = process.env.ADMIN_PASSWORD || 'TenantIQ2026!Admin';

  const now = new Date().toISOString();
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const id = nanoid();

  const sql = `INSERT INTO platform_users (id, organization_id, email, name, role, password_hash, status, email_verified, auth_provider, created_at, updated_at) VALUES ('${id}', NULL, '${email}', '${name}', 'platform_admin', '${passwordHash}', 'active', 1, 'email', '${now}', '${now}');`;

  console.log('Platform Admin Details:');
  console.log('========================');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Name: ${name}`);
  console.log('');
  console.log('Execute this SQL:');
  console.log('=================');
  console.log(sql);
  console.log('');
  console.log('IMPORTANT: Save these credentials securely!');
}

createPlatformAdmin().catch(console.error);

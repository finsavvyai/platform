#!/usr/bin/env node
/**
 * Generate SQL to create platform admin
 * Uses bcryptjs to generate proper password hash
 */

import bcrypt from 'bcryptjs';

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@tenantiq.com';
  const displayName = process.env.ADMIN_NAME || 'Platform Admin';
  const password = process.env.ADMIN_PASSWORD || 'TenantIQ2026!Admin';

  // Generate random ID (simplified nanoid)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }

  // Generate bcrypt hash
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Current timestamp (Unix epoch for created_at, ISO string for updated_at)
  const now = Date.now();
  const createdAt = Math.floor(now / 1000);
  const updatedAt = new Date(now).toISOString();

  const sql = `INSERT INTO platform_users (
  id, organization_id, email, display_name, name, password_hash, role, status,
  email_verified, auth_provider, created_at, updated_at
) VALUES (
  '${id}',
  NULL,
  '${email}',
  '${displayName}',
  '${displayName}',
  '${passwordHash}',
  'platform_admin',
  'active',
  1,
  'email',
  ${createdAt},
  '${updatedAt}'
);`;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('Platform Admin Credentials');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Name:     ${displayName}`);
  console.log(`User ID:  ${id}`);
  console.log('');
  console.log('Execute this SQL command:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(sql);
  console.log('');
  console.log('⚠️  IMPORTANT: Save these credentials securely!');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(console.error);

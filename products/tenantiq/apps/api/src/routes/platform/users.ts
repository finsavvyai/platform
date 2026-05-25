import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.middleware';
import { standardRateLimit } from '../../middleware/rateLimit.middleware';
import type { AppEnv } from '../../index';
import usersCrud from './users-crud';
import usersWrite from './users-write';
import usersInvitations from './users-invitations';

/**
 * Platform User Management Routes
 *
 * Manage users across all organizations including:
 * - Platform admins (your team)
 * - Tenant admins (customer organization admins)
 * - Tenant operators and viewers
 */

const users = new Hono<AppEnv>();

users.use('*', authMiddleware);
users.use('*', standardRateLimit);

// Read operations (list, get by id)
users.route('/', usersCrud);

// Write operations (create, update, delete)
users.route('/', usersWrite);

// Invitation operations (invite, list invitations)
users.route('/', usersInvitations);

export default users;

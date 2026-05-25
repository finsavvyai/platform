import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { signJWT, verifyJWT } from '../auth/jwt.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { rateLimiters } from '../middleware/rateLimit.js';

const authRoute = new Hono();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

authRoute.post('/login', async (c) => {
    return c.json({ success: true })
});

export default authRoute;

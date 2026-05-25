import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { orgInvitations, organizations, orgMembers, users } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { requirePermission } from '../middleware/rbac.js';
import { sendInvitationEmail } from '../services/email-invitation.js';
import { createInvitationSchema } from './validation/invitations.js';

const orgInvitationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

orgInvitationRoutes.use('*', dbMiddleware, authMiddleware);

// Send invitation
orgInvitationRoutes.post(
  '/:orgId/invitations',
  requirePermission('member.invite'),
  async (c) => {
    const db = c.get('db');
    const userId = c.get('userId');
    const orgId = c.req.param('orgId');

    const parsed = createInvitationSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
    }
    const { email, role } = parsed.data;

    // Check for existing pending invitation
    const [existing] = await db
      .select({ id: orgInvitations.id })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.email, email),
          eq(orgInvitations.status, 'pending'),
        ),
      )
      .limit(1);

    if (existing) {
      return c.json({ error: 'Conflict', message: 'Invitation already pending' }, 409);
    }

    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const token = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(orgInvitations).values({
      id: generateId(),
      orgId,
      email,
      role,
      invitedBy: userId,
      token,
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
    });

    // Send invitation email
    await sendInvitationEmail({
      to: email,
      orgName: org?.name ?? 'an organization',
      role,
      token,
      apiKey: c.env.RESEND_API_KEY,
    });

    return c.json({ data: { email, role } }, 201);
  },
);

// List pending invitations
orgInvitationRoutes.get(
  '/:orgId/invitations',
  requirePermission('member.view'),
  async (c) => {
    const db = c.get('db');
    const orgId = c.req.param('orgId');

    const invitations = await db
      .select()
      .from(orgInvitations)
      .where(
        and(eq(orgInvitations.orgId, orgId), eq(orgInvitations.status, 'pending')),
      );

    return c.json({ data: invitations });
  },
);

// Cancel invitation
orgInvitationRoutes.delete(
  '/:orgId/invitations/:invitationId',
  requirePermission('member.invite'),
  async (c) => {
    const db = c.get('db');
    const invitationId = c.req.param('invitationId');

    await db
      .update(orgInvitations)
      .set({ status: 'cancelled' })
      .where(eq(orgInvitations.id, invitationId));

    return c.json({ data: { cancelled: true } });
  },
);

// Accept invitation (public — requires auth but no org membership)
orgInvitationRoutes.post('/invitations/:token/accept', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const token = c.req.param('token');

  const [invitation] = await db
    .select()
    .from(orgInvitations)
    .where(
      and(eq(orgInvitations.token, token), eq(orgInvitations.status, 'pending')),
    )
    .limit(1);

  if (!invitation) {
    return c.json({ error: 'Not Found', message: 'Invalid or expired invitation' }, 404);
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    await db
      .update(orgInvitations)
      .set({ status: 'expired' })
      .where(eq(orgInvitations.id, invitation.id));
    return c.json({ error: 'Gone', message: 'Invitation has expired' }, 410);
  }

  // Verify the accepting user's email matches
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.email !== invitation.email) {
    return c.json(
      { error: 'Forbidden', message: 'Invitation is for a different email' },
      403,
    );
  }

  const now = new Date().toISOString();

  await db.batch([
    db.insert(orgMembers).values({
      id: generateId(),
      orgId: invitation.orgId,
      userId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      invitedAt: now,
      acceptedAt: now,
      status: 'active',
    }),
    db
      .update(orgInvitations)
      .set({ status: 'accepted', acceptedAt: now })
      .where(eq(orgInvitations.id, invitation.id)),
  ]);

  return c.json({ data: { orgId: invitation.orgId, role: invitation.role } });
});

export { orgInvitationRoutes };

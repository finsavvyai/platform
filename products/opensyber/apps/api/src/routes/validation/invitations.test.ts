import { describe, it, expect } from 'vitest';
import { createInvitationSchema } from './invitations.js';

describe('createInvitationSchema', () => {
  it('accepts valid input', () => {
    const result = createInvitationSchema.safeParse({ email: 'bob@example.com', role: 'developer' });
    expect(result.success).toBe(true);
  });

  it('accepts all valid roles', () => {
    const roles = ['owner', 'admin', 'security', 'developer', 'viewer'];
    for (const role of roles) {
      const result = createInvitationSchema.safeParse({ email: 'test@example.com', role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing email', () => {
    const result = createInvitationSchema.safeParse({ role: 'developer' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = createInvitationSchema.safeParse({ email: 'not-an-email', role: 'developer' });
    expect(result.success).toBe(false);
  });

  it('rejects missing role', () => {
    const result = createInvitationSchema.safeParse({ email: 'bob@example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = createInvitationSchema.safeParse({ email: 'bob@example.com', role: 'superadmin' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('role must be one of');
  });

  it('rejects empty object', () => {
    const result = createInvitationSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string email', () => {
    const result = createInvitationSchema.safeParse({ email: 123, role: 'developer' });
    expect(result.success).toBe(false);
  });

  it('rejects non-string role', () => {
    const result = createInvitationSchema.safeParse({ email: 'bob@example.com', role: 42 });
    expect(result.success).toBe(false);
  });
});

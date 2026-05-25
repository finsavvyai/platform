import type { JWT } from 'next-auth/jwt';
import type { Session, User } from 'next-auth';

/**
 * Shared Auth.js callbacks for all OpenSyber products.
 * Handles: profile photo persistence, account linking by email, session enrichment.
 */
export const sharedCallbacks = {
  async jwt({ token, user, trigger, account }: {
    token: JWT;
    user?: User;
    trigger?: 'signIn' | 'signUp' | 'update';
    account?: { provider: string } | null;
  }) {
    if (trigger === 'signIn' && user) {
      token.email = user.email;
      token.name = user.name ?? user.email?.split('@')[0];
      token.picture = user.image;
      if (account) {
        token.provider = account.provider;
      }
    }
    return token;
  },

  async session({ session, token }: { session: Session; token: JWT }) {
    if (session.user) {
      const u = session.user as Record<string, unknown>;
      u.id = token.sub;
      u.image = token.picture;
      u.provider = token.provider;
    }
    return session;
  },
};

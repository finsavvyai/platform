import NextAuth from 'next-auth';
import { buildProviders } from '@opensyber/auth';

const isProduction = process.env.NODE_ENV === 'production';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: buildProviders({
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    },
    microsoft: {
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID,
    },
  }),
  pages: { signIn: '/sign-in' },
  cookies: isProduction ? {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, domain: '.opensyber.cloud' },
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, domain: '.opensyber.cloud' },
    },
    csrfToken: {
      name: '__Host-next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
  } : undefined,
  callbacks: {
    async jwt({ token, user, trigger, session, account }) {
      if (trigger === 'signIn' && user) {
        token.email = user.email;
        token.name = user.name ?? user.email?.split('@')[0];
        token.picture = user.image;
        if (account) token.provider = account.provider;
      }
      if (trigger === 'update' && session?.apiKey) {
        token.apiKey = session.apiKey;
      }
      if (trigger === 'update' && session?.tenantId) {
        token.tenantId = session.tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as unknown as Record<string, unknown>;
        u.id = token.sub;
        u.image = token.picture;
        u.provider = token.provider;
        u.apiKey = token.apiKey;
        u.tenantId = token.tenantId;
      }
      return session;
    },
  },
});

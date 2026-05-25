import NextAuth from 'next-auth';
import { buildProviders, sharedCallbacks } from '@opensyber/auth';

const isProduction = process.env.NODE_ENV === 'production';

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: buildProviders({
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID ?? '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
    },
    microsoft: {
      clientId: process.env.AZURE_AD_CLIENT_ID ?? '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? '',
      tenantId: process.env.AZURE_AD_TENANT_ID,
    },
  }),
  pages: { signIn: '/sign-in' },
  callbacks: sharedCallbacks,
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
});

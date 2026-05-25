import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { CodeBlock } from '@/components/dashboard/CodeBlock';

export const metadata = {
  title: 'Integration Guides — TokenForge',
  description: 'Add TokenForge to React, Angular, Vue, Next.js, or any SSO provider with one script tag.',
};

const reactCode = `// app/providers.tsx — wrap your app
import { TokenForgeProvider } from '@opensyber/tokenforge/react';

export function Providers({ children }) {
  return (
    <TokenForgeProvider config={{
      apiBase: '/api',
      getSessionId: () => document.cookie.match(/session=([^;]+)/)?.[1],
    }}>
      {children}
    </TokenForgeProvider>
  );
}`;

const angularCode = `// app.config.ts — add the HTTP interceptor
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { tokenForgeInterceptor } from './tokenforge.interceptor';

export const appConfig = {
  providers: [provideHttpClient(withInterceptors([tokenForgeInterceptor]))]
};

// tokenforge.interceptor.ts
export const tokenForgeInterceptor: HttpInterceptorFn = (req, next) => {
  // The script tag handles signing automatically.
  // This interceptor is only needed if you want to read tf status.
  return next(req);
};

// index.html — add the script tag
// <script src="https://tokenforge-api.opensyber.cloud/sdk.js"
//   data-api-key="tf_your_api_key"></script>`;

const vueCode = `// main.ts — Vue 3
// Just add the script tag to index.html. That's it.
// The SDK intercepts all fetch() calls globally.

// If you want reactive trust status:
// composables/useTokenForge.ts
import { ref, onMounted } from 'vue';

export function useTokenForge() {
  const bound = ref(false);
  const deviceId = ref<string | null>(null);

  onMounted(() => {
    const tf = (window as any).__tokenforge;
    if (tf) {
      bound.value = tf.isBound();
      deviceId.value = tf.getDeviceId();
    }
  });

  return { bound, deviceId };
}`;

const clerkCode = `<!-- Works automatically with Clerk -->
<!-- The script tag detects Clerk's __clerk_db_jwt cookie -->
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>

<!-- Server: Express + Clerk + TokenForge -->
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';

app.use(ClerkExpressWithAuth());    // Clerk handles auth
app.use(tokenForgeMiddleware({      // TokenForge verifies device
  apiKey: process.env.TOKENFORGE_API_KEY!,
}));`;

const msalCode = `<!-- Works automatically with Microsoft SSO -->
<!-- The script tag detects MSAL session cookies -->
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>

<!-- Server: Express + MSAL + TokenForge -->
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';

// MSAL handles authentication, TokenForge handles session security
app.use(msalMiddleware);            // Microsoft handles auth
app.use(tokenForgeMiddleware({      // TokenForge verifies device
  apiKey: process.env.TOKENFORGE_API_KEY!,
}));`;

const auth0Code = `<!-- Works automatically with Auth0 -->
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>

<!-- Server: any framework -->
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';

app.use(auth0Middleware);           // Auth0 handles auth
app.use(tokenForgeMiddleware({      // TokenForge verifies device
  apiKey: process.env.TOKENFORGE_API_KEY!,
}));`;

const firebaseCode = `<!-- Works automatically with Firebase Auth -->
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>

<!-- The script tag detects Firebase session cookies.
     All fetch() calls to your API are auto-signed. -->`;

interface GuideProps { title: string; id: string; desc: string; code: string }

function Guide({ title, id, desc, code }: GuideProps): React.ReactElement {
  return (
    <div id={id} className="scroll-mt-20">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-sm text-text-secondary mb-4">{desc}</p>
      <CodeBlock code={code} language="typescript" />
    </div>
  );
}

export default function IntegrationsPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-void">
      <header className="border-b border-border/50">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-info" />
            <span className="text-lg font-bold">TokenForge</span>
          </Link>
          <Link href="/docs" className="text-sm text-text-secondary hover:text-text-primary transition">
            Quick Start
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pt-36 pb-24">
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
          Integrations
        </span>
        <h1 className="font-bold text-3xl sm:text-5xl tracking-tight mb-2">Integration Guides</h1>
        <p className="text-text-secondary mb-4">
          TokenForge works with any framework and any auth provider.
          The script tag is always the fastest path — add it to your HTML and you&apos;re done on the client.
        </p>

        <nav className="mb-8 flex flex-wrap gap-2">
          {['React', 'Angular', 'Vue', 'Clerk', 'Microsoft 365', 'Auth0', 'Firebase'].map((n) => (
            <a key={n} href={`#${n.toLowerCase().replace(' ', '-')}`} className="rounded-lg border border-border/50 px-3 py-1.5 text-xs hover:border-info/30 hover:text-info transition">
              {n}
            </a>
          ))}
        </nav>

        <div className="mb-12 gradient-border">
          <div className="rounded-2xl bg-panel px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              Looking for Mobile, AI Agent, or MCP integrations?
            </span>
            <Link href="/docs/integrations/native" className="text-sm text-info hover:text-signal-hover font-medium">
              Native SDKs &rarr;
            </Link>
          </div>
        </div>

        <div className="space-y-12">
          <Guide id="react" title="React / Next.js" desc="Use the React Provider for hooks, or just add the script tag to your index.html." code={reactCode} />
          <Guide id="angular" title="Angular" desc="Add the script tag to index.html. The SDK intercepts all HttpClient requests automatically." code={angularCode} />
          <Guide id="vue" title="Vue 3" desc="Add the script tag. Use the composable for reactive trust status." code={vueCode} />
          <Guide id="clerk" title="Clerk SSO" desc="TokenForge auto-detects Clerk sessions. Add one script tag + one middleware line." code={clerkCode} />
          <Guide id="microsoft-365" title="Microsoft 365 / Entra ID" desc="Works with MSAL.js, next-auth Azure AD provider, or any Microsoft SSO flow." code={msalCode} />
          <Guide id="auth0" title="Auth0" desc="TokenForge works alongside Auth0. The script tag detects Auth0 session cookies." code={auth0Code} />
          <Guide id="firebase" title="Firebase Auth" desc="Add the script tag. Works with Firebase Authentication out of the box." code={firebaseCode} />
        </div>
      </main>
    </div>
  );
}

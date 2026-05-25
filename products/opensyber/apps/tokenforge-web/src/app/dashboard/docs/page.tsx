import { CodeBlock } from '@/components/dashboard/CodeBlock';
import { ScriptTagBlock } from '@/components/dashboard/ScriptTagBlock';

export const metadata = {
  title: 'Quick Start',
};

const scriptTagCode = `<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>`;

const serverCode = `npm install @opensyber/tokenforge

// Express
import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';
app.use(tokenForgeMiddleware({ apiKey: process.env.TOKENFORGE_API_KEY! }));

// Next.js
import { withTokenForge } from '@opensyber/tokenforge/nextjs';
export const GET = withTokenForge(handler, { apiKey: process.env.TOKENFORGE_API_KEY! });

// Fastify
import { tokenForgePlugin } from '@opensyber/tokenforge/fastify';
fastify.register(tokenForgePlugin, { apiKey: process.env.TOKENFORGE_API_KEY! });`;

const verifyCode = `// In your browser console:
const response = await fetch('/api/protected');
console.log(response.status);
// 200 — signed request, session valid

// From a different device with a stolen cookie:
// 401 — signature mismatch, session revoked`;

export default function DocsPage(): React.ReactElement {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Quick Start</h1>
        <p className="mt-1 text-sm text-text-secondary">
          One script tag. One middleware line. Done.
        </p>
      </div>

      <div className="space-y-8">
        <Step number={1} title="Add to your app">
          <p className="mb-4 text-sm text-text-secondary">
            <strong className="text-text-primary">Client</strong> — one script tag. Auto-generates device keys and signs every request.
          </p>
          <ScriptTagBlock />
          <p className="mt-6 mb-4 text-sm text-text-secondary">
            <strong className="text-text-primary">Server</strong> — one line of middleware. Choose your framework:
          </p>
          <CodeBlock code={serverCode} language="typescript" />
        </Step>

        <Step number={2} title="Verify it works">
          <p className="mb-4 text-sm text-text-secondary">
            Make an API call from your app. TokenForge auto-signs the
            request. If the signature matches, it passes. If not, it&apos;s blocked.
          </p>
          <CodeBlock code={verifyCode} language="typescript" />
        </Step>
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border/50 bg-panel p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info/10 text-sm font-bold text-info">
          {number}
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

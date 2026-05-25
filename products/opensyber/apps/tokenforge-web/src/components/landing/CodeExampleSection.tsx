'use client';

import { motion } from 'framer-motion';

const ease = [0.25, 0.1, 0.25, 1] as const;

const clientCode = `<!-- Add to your HTML <head> — that's it -->
<script
  src="https://tokenforge-api.opensyber.cloud/sdk.js"
  data-api-key="tf_your_api_key"
></script>

<!-- Auto-binds device, auto-signs all fetch() calls -->`;

const serverCode = `import { tokenForgeMiddleware } from '@opensyber/tokenforge/express';

app.use(tokenForgeMiddleware({
  apiKey: process.env.TOKENFORGE_API_KEY!,
}));

// req.tf.bound, req.tf.trustScore, req.tf.deviceId`;

interface CodeBlockProps {
  title: string;
  label: string;
  code: string;
  delay: number;
}

function CodeBlock({ title, label, code, delay }: CodeBlockProps): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay, duration: 0.5, ease }}
      className="gradient-border"
    >
      <div className="rounded-2xl bg-panel overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-surface/50">
          <span className="text-xs text-text-muted">{title}</span>
          <span className="text-xs font-medium text-info rounded-full bg-info/10 px-2 py-0.5">
            {label}
          </span>
        </div>
        <pre className="p-6 text-xs leading-relaxed overflow-x-auto">
          <code className="text-text-secondary">{code}</code>
        </pre>
      </div>
    </motion.div>
  );
}

export function CodeExampleSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            Integration
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">Two Lines. That&apos;s It.</h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Drop-in client SDK with automatic request signing. Framework-agnostic server middleware.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          <CodeBlock title="app.ts" label="Client" code={clientCode} delay={0} />
          <CodeBlock title="server.ts" label="Server" code={serverCode} delay={0.15} />
        </div>
      </div>
    </section>
  );
}

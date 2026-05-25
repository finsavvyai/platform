'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

const codeLines = [
  { key: 'comment', text: '<!-- Add one script tag. That\'s it. -->' },
  { key: 'script', text: '<script' },
  { key: 'src', text: '  src="https://tokenforge-api.opensyber.cloud/sdk.js"' },
  { key: 'attr', text: '  data-api-key="tf_your_api_key"' },
  { key: 'close', text: '></script>' },
  { key: 'auto', text: '<!-- Device keys auto-generated, fetch() auto-signed -->' },
];

function CodeSnippet(): React.ReactElement {
  return (
    <div className="gradient-border">
      <div className="rounded-2xl bg-panel p-6 font-mono text-sm text-left">
        <div className="flex items-center gap-2 mb-4 text-text-muted text-xs">
          <span className="h-3 w-3 rounded-full bg-alert/50" />
          <span className="h-3 w-3 rounded-full bg-warn/50" />
          <span className="h-3 w-3 rounded-full bg-ok/50" />
          <span className="ml-2">index.html</span>
        </div>
        <div className="space-y-1.5 text-xs leading-relaxed">
          {codeLines.map((line, i) => (
            <motion.p
              key={line.key}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 + i * 0.12, duration: 0.3, ease }}
            >
              {line.key === 'comment' ? (
                <span className="text-ok">{line.text}</span>
              ) : (
                <span className="text-text-secondary">{line.text}</span>
              )}
            </motion.p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeroSection(): React.ReactElement {
  return (
    <section className="relative pt-36 pb-24 md:pb-32 overflow-hidden hero-gradient">
      <div className="orb top-20 -left-40 h-80 w-80 bg-info/10" style={{ animationDelay: '0s' }} />
      <div className="orb top-40 -right-40 h-80 w-80 bg-signal/8" style={{ animationDelay: '-7s' }} />
      <div className="orb top-60 left-1/3 h-60 w-60 bg-purple-500/6" style={{ animationDelay: '-14s' }} />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium mb-6 tracking-wide border border-alert/30 bg-alert/8 text-alert"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse bg-alert"
                style={{ boxShadow: '0 0 8px #ef4444' }}
              />
              AiTM phishing bypasses MFA in 2 minutes — RSA 2026
              <a
                href="https://opensyber.cloud/blog/ai-agent-kill-chain"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold no-underline pl-2 text-alert border-l border-alert/30"
              >
                What you can do
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease }}
            >
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 inline-block">
                Post-authentication session security
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease }}
              className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight leading-[1.05]"
            >
              Your auth stops at login.{' '}
              <span className="text-gradient">We protect everything after.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease }}
              className="mt-6 max-w-xl text-lg text-text-secondary leading-relaxed"
            >
              Add one script tag. Device keys are auto-generated, every request is signed,
              and a stolen cookie without the device key is useless.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5, ease }}
              className="mt-10 flex flex-col sm:flex-row items-center lg:items-start gap-4"
            >
              <Link
                href="/sign-up"
                className="rounded-lg bg-info text-void px-8 py-4 text-base font-medium glow-info hover:brightness-110 transition flex items-center gap-2"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-border/50 px-8 py-4 text-base font-medium text-text-secondary hover:border-text-secondary hover:text-text-primary transition flex items-center gap-2"
              >
                Read the Docs
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.65, ease }}
              className="mt-4 text-sm text-text-muted"
            >
              One script tag. Zero dependencies. Free forever.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease }}
            className="hidden md:block"
          >
            <CodeSnippet />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

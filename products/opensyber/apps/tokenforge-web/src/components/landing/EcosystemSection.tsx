'use client';

import { motion } from 'framer-motion';
import { Shield, KeyRound } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

export function EcosystemSection(): React.ReactElement {
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
            Ecosystem
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">
            Part of the OpenSyber security ecosystem.
          </h2>
          <p className="text-text-secondary max-w-xl mx-auto text-lg">
            Two layers of protection for modern development teams.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          <motion.a
            href="https://opensyber.cloud"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease }}
            className="gradient-border card-hover no-underline block"
          >
            <div className="rounded-2xl bg-panel p-8">
              <Shield className="h-8 w-8 text-info mb-4" />
              <div className="text-lg font-semibold mb-1 text-text-primary">OpenSyber</div>
              <div className="text-xs text-text-muted font-mono mb-3">opensyber.cloud</div>
              <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                Runtime security for AI agents. Monitors what Claude Code, Cursor,
                and Windsurf actually do.
              </p>
              <div className="text-xs text-text-muted mb-4">
                Protects: AI agent actions
              </div>
              <span className="text-sm font-medium text-info">
                Visit OpenSyber &rarr;
              </span>
            </div>
          </motion.a>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: 0.1, duration: 0.5, ease }}
            className="relative gradient-border card-hover glow-info"
          >
            <div className="rounded-2xl bg-panel p-8">
              <span className="absolute -top-3 right-4 rounded-full bg-info text-void px-3 py-1 text-xs font-medium">
                You are here
              </span>
              <KeyRound className="h-8 w-8 text-info mb-4" />
              <div className="text-lg font-semibold mb-1 text-text-primary">TokenForge</div>
              <div className="text-xs text-text-muted font-mono mb-3">
                tokenforge.opensyber.cloud
              </div>
              <p className="text-sm text-text-secondary mb-4 leading-relaxed">
                Device-bound session security. Makes stolen tokens worthless
                via ECDSA P-256.
              </p>
              <div className="text-xs text-text-muted">
                Protects: Developer sessions
              </div>
            </div>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5, ease }}
          className="text-center text-sm text-text-muted mt-10 max-w-lg mx-auto"
        >
          Together: from the moment your developer logs in to the last request
          their AI agent makes.
        </motion.p>
      </div>
    </section>
  );
}

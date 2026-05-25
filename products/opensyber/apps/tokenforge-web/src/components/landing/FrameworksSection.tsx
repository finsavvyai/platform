'use client';

import { motion } from 'framer-motion';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface PlatformCategory {
  label: string;
  items: string[];
}

const categories: PlatformCategory[] = [
  { label: 'Web', items: ['Script Tag', 'Express', 'Next.js', 'Hono', 'Fastify'] },
  { label: 'Mobile', items: ['Swift (iOS)', 'Kotlin (Android)', 'React Native'] },
  { label: 'AI Agents', items: ['Python', 'Go', 'MCP Server'] },
  { label: 'Zero Code', items: ['DNS Proxy'] },
];

export function FrameworksSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50 bg-panel/40">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-12"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            Platform Support
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">Every Platform. One API Key.</h2>
          <p className="text-text-secondary max-w-xl mx-auto text-lg">
            Web, mobile, AI agents, microservices — all protected by the same trust scoring engine.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, ci) => (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ci * 0.12, duration: 0.4, ease }}
              className="gradient-border card-hover"
            >
              <div className="rounded-2xl bg-panel p-5">
                <h3 className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-3">
                  {cat.label}
                </h3>
                <ul className="space-y-2">
                  {cat.items.map((item, i) => (
                    <motion.li
                      key={item}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: ci * 0.12 + i * 0.06, duration: 0.3, ease }}
                      className="text-sm text-text-primary hover:text-info transition-colors"
                    >
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

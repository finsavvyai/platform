'use client';

import { motion } from 'framer-motion';

const lines = [
  { key: 'comment', color: 'text-green-400', text: '// Device bound via ECDSA P-256' },
  { key: 'device', color: '', text: '', parts: [
    { color: 'text-signal', text: 'device_id' },
    { color: 'text-text-dim', text: ': ' },
    { color: 'text-text-primary', text: 'd4e2f8a1c3b5...' },
  ]},
  { key: 'trust', color: '', text: '', parts: [
    { color: 'text-signal', text: 'trust_score' },
    { color: 'text-text-dim', text: ': ' },
    { color: 'text-green-400', text: '94/100' },
  ]},
  { key: 'sig', color: '', text: '', parts: [
    { color: 'text-signal', text: 'signature' },
    { color: 'text-text-dim', text: ': verified ' },
    { color: 'text-green-400', text: '+40' },
  ]},
  { key: 'ip', color: '', text: '', parts: [
    { color: 'text-signal', text: 'ip_match' },
    { color: 'text-text-dim', text: ': same_subnet ' },
    { color: 'text-green-400', text: '+10' },
  ]},
  { key: 'geo', color: '', text: '', parts: [
    { color: 'text-signal', text: 'geo_match' },
    { color: 'text-text-dim', text: ': EU (Frankfurt) ' },
    { color: 'text-green-400', text: '+15' },
  ]},
  { key: 'fp', color: '', text: '', parts: [
    { color: 'text-signal', text: 'fingerprint' },
    { color: 'text-text-dim', text: ': match ' },
    { color: 'text-green-400', text: '+10' },
  ]},
  { key: 'nonce', color: '', text: '', parts: [
    { color: 'text-signal', text: 'nonce' },
    { color: 'text-text-dim', text: ': fresh (2ms) ' },
    { color: 'text-green-400', text: '+5' },
  ]},
  { key: 'action', color: 'text-yellow-400', text: 'action: allow' },
];

export function TypedTerminal(): React.ReactElement {
  return (
    <div className="p-6 font-mono text-sm">
      <div className="flex items-center gap-2 mb-5 text-text-dim text-xs">
        <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
        <span className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
        <span className="h-3 w-3 rounded-full bg-[#28C840]" />
        <span className="ml-3 font-[family-name:var(--font-mono)] text-[11px] text-text-muted">tokenforge — session audit</span>
      </div>
      <div className="space-y-2 text-xs leading-relaxed">
        {lines.map((line, i) => (
          <motion.p
            key={line.key}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            className={line.color}
          >
            {line.text ||
              line.parts?.map((p, j) => (
                <span key={j} className={p.color}>{p.text}</span>
              ))}
          </motion.p>
        ))}
      </div>
    </div>
  );
}

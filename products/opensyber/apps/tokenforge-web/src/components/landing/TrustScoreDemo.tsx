'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Signal {
  key: string;
  label: string;
  weight: number;
}

const signals: Signal[] = [
  { key: 'signature', label: 'Signature Valid', weight: 40 },
  { key: 'ip', label: 'IP Consistent', weight: 15 },
  { key: 'geo', label: 'Geo Consistent', weight: 15 },
  { key: 'browser', label: 'Browser Match', weight: 10 },
  { key: 'velocity', label: 'Velocity Normal', weight: 10 },
  { key: 'time', label: 'Time of Day', weight: 5 },
  { key: 'nonce', label: 'Nonce Fresh', weight: 5 },
];

function getAction(score: number): { label: string; color: string; ring: string } {
  if (score >= 80) return { label: 'ALLOW', color: 'text-ok bg-ok/15 border-ok/40', ring: '#2ECC7B' };
  if (score >= 60) return { label: 'FLAG', color: 'text-warn bg-warn/15 border-warn/40', ring: '#FFB347' };
  if (score >= 40) return { label: 'STEP-UP', color: 'text-warn-muted bg-warn-muted/15 border-warn-muted/40', ring: '#F5A623' };
  return { label: 'REVOKE', color: 'text-alert bg-alert/15 border-alert/40', ring: '#FF4D4D' };
}

function ScoreRing({ score, color }: { score: number; color: string }): React.ReactElement {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="block">
      <circle cx="90" cy="90" r={radius} fill="none" stroke="#1C2940" strokeWidth="10" />
      <circle
        cx="90" cy="90" r={radius}
        fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 90 90)"
        style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
      />
      <text x="90" y="85" textAnchor="middle" fill="#E8F0F8" fontSize="36" fontWeight="bold">
        {score}
      </text>
      <text x="90" y="108" textAnchor="middle" fill="#7A96B2" fontSize="13">
        / 100
      </text>
    </svg>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${on ? 'bg-ok' : 'bg-wire'}`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${on ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

export function TrustScoreDemo(): React.ReactElement {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(signals.map((s) => [s.key, true])),
  );

  const score = useMemo(() => {
    if (!enabled.signature) return 0;
    return signals.reduce((sum, s) => sum + (enabled[s.key] ? s.weight : 0), 0);
  }, [enabled]);

  const action = getAction(score);

  const toggle = (key: string) => setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5 }}
      className="mt-16 gradient-border"
    >
      <div className="rounded-2xl bg-panel p-8">
        <h3 className="text-xl font-semibold mb-6 text-center">Try It: Interactive Trust Score</h3>

        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className="space-y-3">
            {signals.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-secondary flex-1">{s.label}</span>
                <span className="text-xs font-mono text-text-muted w-10 text-right">{s.weight}pts</span>
                <Toggle on={!!enabled[s.key]} onToggle={() => toggle(s.key)} />
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            <ScoreRing score={score} color={action.ring} />
            <span className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${action.color}`}>
              {action.label}
            </span>
          </div>
        </div>

        <p className="text-xs text-text-muted text-center mt-6 max-w-lg mx-auto">
          Toggle &quot;Signature Valid&quot; off to see what happens when a stolen cookie
          is used from another machine.
        </p>
      </div>
    </motion.div>
  );
}

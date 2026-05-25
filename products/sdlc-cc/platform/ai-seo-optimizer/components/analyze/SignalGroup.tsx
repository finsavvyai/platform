import { motion } from 'framer-motion';
import { Check, AlertTriangle, X } from 'lucide-react';
import type { ContentSignal } from '../../lib/types';

interface SignalGroupProps {
  title: string;
  signals: ContentSignal[];
}

const statusConfig = {
  pass: { icon: Check, color: 'text-score-high', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  warn: { icon: AlertTriangle, color: 'text-score-medium', bg: 'bg-amber-50', border: 'border-amber-100' },
  fail: { icon: X, color: 'text-score-low', bg: 'bg-red-50', border: 'border-red-100' },
};

const SignalGroup = ({ title, signals }: SignalGroupProps) => {
  const groupScore = signals.reduce((s, sig) => s + sig.score, 0);
  const groupMax = signals.reduce((s, sig) => s + sig.maxScore, 0);
  const pct = groupMax > 0 ? Math.round((groupScore / groupMax) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{groupScore}/{groupMax}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${pct >= 70 ? 'bg-emerald-50 text-score-high' : pct >= 40 ? 'bg-amber-50 text-score-medium' : 'bg-red-50 text-score-low'}`}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {signals.map((signal, i) => {
          const cfg = statusConfig[signal.status];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={signal.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="px-5 py-4"
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.border} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{signal.name}</span>
                    <span className="text-xs font-medium text-slate-500">
                      {signal.score}/{signal.maxScore}
                    </span>
                  </div>
                  {signal.status !== 'pass' && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {signal.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SignalGroup;

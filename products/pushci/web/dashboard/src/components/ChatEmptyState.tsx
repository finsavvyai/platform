interface Props {
  onSend: (text: string) => void;
}

const quickActions = [
  { label: 'Why did my build fail?', icon: '!', desc: 'Root cause analysis', color: 'amber' },
  { label: 'Deploy to staging', icon: '^', desc: 'Ship to staging env', color: 'blue' },
  { label: 'Optimize my pipeline', icon: '~', desc: 'Speed up your CI', color: 'indigo' },
  { label: 'Generate pipeline', icon: '+', desc: 'AI creates your config', color: 'emerald' },
  { label: 'Run all checks', icon: '>', desc: 'Build, test, lint', color: 'cyan' },
  { label: 'Heal my pipeline', icon: '&', desc: 'Auto-fix failures', color: 'purple' },
];

const colorMap: Record<string, string> = {
  amber: 'hover:border-amber-500/40 hover:bg-amber-500/5',
  blue: 'hover:border-blue-500/40 hover:bg-blue-500/5',
  indigo: 'hover:border-indigo-500/40 hover:bg-indigo-500/5',
  emerald: 'hover:border-emerald-500/40 hover:bg-emerald-500/5',
  cyan: 'hover:border-cyan-500/40 hover:bg-cyan-500/5',
  purple: 'hover:border-purple-500/40 hover:bg-purple-500/5',
};

const iconColor: Record<string, string> = {
  amber: 'text-amber-400', blue: 'text-blue-400', indigo: 'text-indigo-400',
  emerald: 'text-emerald-400', cyan: 'text-cyan-400', purple: 'text-purple-400',
};

export default function ChatEmptyState({ onSend }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-lg px-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-5 animate-float">
          <span className="text-2xl text-accent font-mono font-bold">&gt;_</span>
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">PushCI Assistant</h2>
        <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
          Control your CI/CD with natural language. Ask anything.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => onSend(a.label)}
              className={`text-left px-4 py-3.5 rounded-xl glass border border-surface-border transition-all active:scale-[0.98] ${colorMap[a.color] || ''}`}>
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-lg bg-surface-hover flex items-center justify-center font-mono font-bold text-sm ${iconColor[a.color] || 'text-zinc-400'}`}>{a.icon}</span>
                <div>
                  <span className="text-sm text-zinc-200 font-medium block">{a.label}</span>
                  <span className="text-[11px] text-zinc-500">{a.desc}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

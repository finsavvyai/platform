import { Link } from 'react-router-dom';
import { Skill, Project } from './types';

interface ProjectStepProps {
  projects: Project[];
  selected: string;
  onSelect: (id: string) => void;
}

export function ProjectStep({ projects, selected, onSelect }: ProjectStepProps) {
  if (projects.length === 0) {
    return <p className="text-xs text-zinc-500 py-4">No projects connected. Go to Projects to add one.</p>;
  }
  return (
    <div className="space-y-1.5 max-h-40 overflow-y-auto">
      {projects.map(p => (
        <button key={p.id} onClick={() => onSelect(p.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${
            selected === p.id ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-600'
          }`}>
          <span className={`w-4 h-4 rounded-full border ${selected === p.id ? 'border-emerald-500 bg-emerald-500' : 'border-zinc-600'}`} />
          <span className="truncate">{p.repo}</span>
        </button>
      ))}
    </div>
  );
}

interface ConfigStepProps {
  envVars: string[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
}

export function ConfigStep({ envVars, values, onChange }: ConfigStepProps) {
  if (envVars.length === 0) {
    return <p className="text-xs text-zinc-400 py-4">No configuration required. Click Next to continue.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-400 mb-1">This skill requires the following environment variables:</p>
      {envVars.map(v => (
        <div key={v}>
          <label className="text-xs text-zinc-300 font-mono block mb-1">{v}</label>
          <input value={values[v] || ''} onChange={e => onChange(v, e.target.value)} placeholder={`Enter ${v}...`}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none font-mono" />
        </div>
      ))}
    </div>
  );
}

interface ReviewStepProps { skill: Skill; projectRepo: string; envVars: string[]; values: Record<string, string>; }

export function ReviewStep({ skill, projectRepo, envVars, values }: ReviewStepProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-400">The following will be added to your pipeline:</p>
      <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-3 font-mono text-[11px] text-zinc-300 whitespace-pre-line">
        {`# ${skill.name} v${skill.version}\n`}
        {`project: ${projectRepo}\n`}
        {skill.steps.map(s => `- ${s.name}: ${s.run}`).join('\n')}
        {envVars.length > 0 && '\n\n# Secrets'}
        {envVars.map(v => `\n${v}: ${values[v] ? '********' : '(not set)'}`).join('')}
      </div>
    </div>
  );
}

export function UpgradeStep({ tier }: { tier: string }) {
  const plan = tier === 'pro' ? 'Pro' : 'Team';
  return (
    <div className="text-center py-4 space-y-3">
      <p className="text-sm text-zinc-300">This is a <span className="font-medium text-amber-400">{plan}</span> skill.</p>
      <p className="text-xs text-zinc-500">Upgrade your plan to install premium skills.</p>
      <Link to={`/billing?upgrade=${tier}`}
        className="inline-block rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-medium text-black hover:bg-emerald-400 transition">
        Upgrade to {plan}
      </Link>
    </div>
  );
}

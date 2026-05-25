import { useState } from 'react';
import { Skill, Project } from './types';
import { API_BASE_URL } from '../../config';
import SkillBreadcrumbs from './SkillBreadcrumbs';
import { ProjectStep, ConfigStep, ReviewStep, UpgradeStep } from './SkillInstallSteps';

interface Props { skill: Skill; projects: Project[]; onClose: () => void; onInstalled: () => void; }

function getEnvVars(skill: Skill) {
  return (skill.prerequisites || []).filter(p => p === p.toUpperCase() && p.includes('_'));
}

export default function SkillInstallWizard({ skill, projects, onClose, onInstalled }: Props) {
  const needsUpgrade = skill.tier !== 'free';
  const envVars = getEnvVars(skill);
  const [step, setStep] = useState(needsUpgrade ? -1 : 0);
  const [projectId, setProjectId] = useState('');
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);

  const projectRepo = projects.find(p => p.id === projectId)?.repo || '';

  const install = async () => {
    setInstalling(true);
    const token = localStorage.getItem('pushci_token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/skills/${skill.id}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ project_id: projectId, env_vars: envValues }),
      });
      if (res.ok) { setDone(true); setStep(3); onInstalled(); }
    } catch {} finally { setInstalling(false); }
  };

  if (step === -1) return <UpgradeStep tier={skill.tier} />;

  if (done) {
    return (
      <div className="text-center py-4">
        <SkillBreadcrumbs current={3} />
        <p className="text-sm text-emerald-400 font-medium">Successfully installed!</p>
        <p className="text-xs text-zinc-500 mt-1">{skill.name} is now active on {projectRepo}</p>
        {envVars.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-left">
            <p className="text-xs text-amber-400 font-medium mb-1">Set secrets via CLI:</p>
            {envVars.map(v => (
              <code key={v} className="block text-[11px] text-zinc-300 font-mono mt-1">
                pushci secret set {v} &lt;your-value&gt;
              </code>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-3 px-4 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition">
          Close
        </button>
      </div>
    );
  }

  return (
    <div>
      <SkillBreadcrumbs current={step} />
      {step === 0 && <ProjectStep projects={projects} selected={projectId} onSelect={setProjectId} />}
      {step === 1 && <ConfigStep envVars={envVars} values={envValues} onChange={(k, v) => setEnvValues(prev => ({ ...prev, [k]: v }))} />}
      {step === 2 && <ReviewStep skill={skill} projectRepo={projectRepo} envVars={envVars} values={envValues} />}
      <div className="flex gap-3 mt-4">
        {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition">Back</button>}
        {step < 2 ? (
          <button onClick={() => setStep(step + 1)} disabled={step === 0 && !projectId}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 transition">
            Next
          </button>
        ) : (
          <button onClick={install} disabled={installing}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-black hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500 transition">
            {installing ? 'Installing...' : 'Install'}
          </button>
        )}
        <button onClick={onClose} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800 transition">Cancel</button>
      </div>
      <p className="text-[11px] text-zinc-600 text-center mt-2">
        Or via CLI: <code className="text-emerald-400">pushci skill add {skill.id}</code>
      </p>
    </div>
  );
}

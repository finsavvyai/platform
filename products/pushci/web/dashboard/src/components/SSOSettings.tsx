import { useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import LockedFeature from './LockedFeature';
import { btnGesturePrimary } from '../styles/gestures';

export default function SSOSettings() {
  const { hasFeature } = usePlan();
  const [provider, setProvider] = useState('');
  const [entityId, setEntityId] = useState('');
  const [cert, setCert] = useState('');
  const [saved, setSaved] = useState(false);

  if (!hasFeature('pro')) {
    return <LockedFeature title="Single Sign-On (SSO)" requiredPlan="team" description="SSO requires the Team plan." />;
  }

  if (!hasFeature('team')) {
    return <LockedFeature title="Single Sign-On (SSO)" requiredPlan="team" description="SSO is available on the Team plan." />;
  }

  const configured = !!(provider && entityId && cert);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputCls = 'w-full px-3 py-2 text-sm bg-surface-hover/50 border border-surface-border rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${configured ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <span className="text-xs text-zinc-500">{configured ? 'Configured' : 'Not configured'}</span>
      </div>
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">SAML Provider URL</label>
        <input value={provider} onChange={e => setProvider(e.target.value)} placeholder="https://idp.example.com/saml" className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Entity ID</label>
        <input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="urn:pushci:saml" className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-zinc-400 mb-1 block">Certificate</label>
        <textarea value={cert} onChange={e => setCert(e.target.value)} rows={3} placeholder="-----BEGIN CERTIFICATE-----" className={inputCls} />
      </div>
      <button onClick={handleSave} className={`px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 ${btnGesturePrimary}`}>
        {saved ? 'Saved!' : 'Save SSO Config'}
      </button>
    </div>
  );
}

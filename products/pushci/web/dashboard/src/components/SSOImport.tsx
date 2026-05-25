import { useState } from 'react';
import { API_BASE_URL } from '../config';
import Select from './Select';

interface Member {
  project_id: string; user_sub: string; login: string;
  provider: string; role: string; repo: string; created_at: string;
}
interface Project { id: string; repo: string; platform: string; }

const ROLES = ['developer', 'viewer', 'auditor', 'deploy_approver', 'release_manager', 'maintainer'];
const SSO_PROVIDERS = [
  { id: 'github', label: 'GitHub Org', icon: 'GH', color: 'from-zinc-600 to-zinc-800' },
  { id: 'microsoft', label: 'Microsoft 365', icon: 'MS', color: 'from-blue-500 to-blue-700' },
  { id: 'google', label: 'Google Workspace', icon: 'GW', color: 'from-red-500 to-amber-500' },
  { id: 'okta', label: 'Okta', icon: 'OK', color: 'from-indigo-500 to-indigo-700' },
];

function token() { return localStorage.getItem('pushci_token'); }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const t = token();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...opts?.headers },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function SSOImport({ projects, onImported }: {
  projects: Project[];
  onImported: (ms: Member[]) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [role, setRole] = useState('developer');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [ghOrg, setGhOrg] = useState('');
  const [msToken, setMsToken] = useState('');
  const [googleToken, setGoogleToken] = useState('');
  const [googleDomain, setGoogleDomain] = useState('');
  const [oktaDomain, setOktaDomain] = useState('');
  const [oktaToken, setOktaToken] = useState('');

  const doImport = async () => {
    setImporting(true);
    setResult(null);
    try {
      let endpoint = '';
      const body: Record<string, string> = { project_id: projectId, role };
      if (selectedProvider === 'github') { endpoint = '/api/team/import/github'; body.org = ghOrg; }
      else if (selectedProvider === 'microsoft') { endpoint = '/api/team/import/microsoft'; body.access_token = msToken; }
      else if (selectedProvider === 'google') { endpoint = '/api/team/import/google'; body.access_token = googleToken; body.domain = googleDomain; }
      else if (selectedProvider === 'okta') { endpoint = '/api/team/import/okta'; body.okta_domain = oktaDomain; body.api_token = oktaToken; }

      const res = await apiFetch<{ ok: boolean; imported: number; members: Array<{ name?: string; email?: string } | string> }>(endpoint, {
        method: 'POST', body: JSON.stringify(body),
      });
      const repo = projects.find(p => p.id === projectId)?.repo || '';
      const newMembers: Member[] = (res.members || []).map((m, i) => ({
        project_id: projectId, user_sub: `${selectedProvider}:import-${i}`,
        login: typeof m === 'string' ? m : (m.email?.split('@')[0] || m.name || `user-${i}`),
        provider: selectedProvider || 'unknown', role, repo, created_at: new Date().toISOString(),
      }));
      onImported(newMembers);
      setResult({ ok: true, text: `Imported ${res.imported} members from ${selectedProvider}` });
    } catch (e) {
      setResult({ ok: false, text: 'Import failed. Please check credentials and try again.' });
    } finally { setImporting(false); }
  };

  return (
    <div className="max-w-lg">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">Import from Identity Provider</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {SSO_PROVIDERS.map(p => (
          <button key={p.id} onClick={() => setSelectedProvider(p.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border transition ${selectedProvider === p.id ? 'border-accent/40 bg-accent/5' : 'border-surface-border bg-surface-card hover:border-zinc-600'}`}>
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${p.color} flex items-center justify-center text-white text-xs font-bold`}>{p.icon}</div>
            <span className="text-sm text-zinc-200">{p.label}</span>
          </button>
        ))}
      </div>
      {selectedProvider && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Project</label>
              <Select value={projectId} onChange={setProjectId}
                options={projects.map(p => ({ value: p.id, label: p.repo }))} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Default Role</label>
              <Select value={role} onChange={setRole}
                options={ROLES.map(r => ({ value: r, label: r }))} />
            </div>
          </div>
          {selectedProvider === 'github' && <Input label="GitHub Organization" value={ghOrg} onChange={setGhOrg} placeholder="finsavvyai" />}
          {selectedProvider === 'microsoft' && <Input label="Microsoft Access Token" value={msToken} onChange={setMsToken} type="password" placeholder="Paste Microsoft Graph token" hint="Get a token from Azure AD > App registrations" />}
          {selectedProvider === 'google' && (<><Input label="Google Access Token" value={googleToken} onChange={setGoogleToken} type="password" placeholder="Paste Google Admin token" /><Input label="Domain" value={googleDomain} onChange={setGoogleDomain} placeholder="company.com" /></>)}
          {selectedProvider === 'okta' && (<><Input label="Okta Domain" value={oktaDomain} onChange={setOktaDomain} placeholder="company.okta.com" /><Input label="API Token" value={oktaToken} onChange={setOktaToken} type="password" placeholder="Okta API token" /></>)}
          <button onClick={doImport} disabled={importing}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-accent-hover disabled:bg-zinc-700 disabled:text-zinc-500 transition">
            {importing ? 'Importing...' : `Import from ${SSO_PROVIDERS.find(p => p.id === selectedProvider)?.label}`}
          </button>
          {result && <p className={`text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>{result.text}</p>}
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} type={type || 'text'} placeholder={placeholder}
        className="w-full rounded-lg border border-surface-border bg-surface-hover px-3 py-2.5 text-sm text-zinc-100 focus:border-accent focus:outline-none" />
      {hint && <p className="text-[11px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

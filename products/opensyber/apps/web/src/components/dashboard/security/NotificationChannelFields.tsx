'use client';

interface FieldProps {
  form: Record<string, string>;
  setForm: (form: Record<string, string>) => void;
}

const inputClass = 'w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white';

function Field({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-text-secondary mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} className={inputClass} />
    </div>
  );
}

export function PagerDutyFields({ form, setForm }: FieldProps) {
  return (
    <Field label="Routing Key" placeholder="Your PagerDuty routing key"
      value={form.pagerdutyKey || ''} onChange={(v) => setForm({ ...form, pagerdutyKey: v })} />
  );
}

export function OpsGenieFields({ form, setForm }: FieldProps) {
  return (
    <div className="space-y-3">
      <Field label="API Key" placeholder="Your OpsGenie API key"
        value={form.opsgenieKey || ''} onChange={(v) => setForm({ ...form, opsgenieKey: v })} />
      <Field label="Team (optional)" placeholder="Team name"
        value={form.opsgenieTeam || ''} onChange={(v) => setForm({ ...form, opsgenieTeam: v })} />
    </div>
  );
}

export function TeamsFields({ form, setForm }: FieldProps) {
  return (
    <Field label="Teams Webhook URL" placeholder="https://outlook.office.com/webhook/..."
      type="url" value={form.teamsUrl || ''} onChange={(v) => setForm({ ...form, teamsUrl: v })} />
  );
}

export function DiscordFields({ form, setForm }: FieldProps) {
  return (
    <Field label="Discord Webhook URL" placeholder="https://discord.com/api/webhooks/..."
      type="url" value={form.discordUrl || ''} onChange={(v) => setForm({ ...form, discordUrl: v })} />
  );
}

export function buildConfig(channelType: string, form: Record<string, string>): Record<string, string> | null {
  switch (channelType) {
    case 'pagerduty':
      if (!form.pagerdutyKey?.trim()) return null;
      return { routingKey: form.pagerdutyKey };
    case 'opsgenie':
      if (!form.opsgenieKey?.trim()) return null;
      return { apiKey: form.opsgenieKey, ...(form.opsgenieTeam ? { team: form.opsgenieTeam } : {}) };
    case 'teams':
      if (!form.teamsUrl?.trim()) return null;
      return { webhookUrl: form.teamsUrl };
    case 'discord':
      if (!form.discordUrl?.trim()) return null;
      return { webhookUrl: form.discordUrl };
    default:
      return null;
  }
}

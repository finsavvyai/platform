interface AlertCfg {
  email?: string; whatsapp?: string; slack_webhook?: string; enabled: boolean;
}

interface Props {
  cfg: AlertCfg; onChange: (c: AlertCfg) => void; onSave: () => void;
}

export function AlertSettings({ cfg, onChange, onSave }: Props) {
  return (
    <div className="glass-panel rounded-apple-lg p-lg mb-lg space-y-md">
      <h3 className="sf-headline sf-title">Failure Alert Settings</h3>
      <label className="flex items-center gap-sm cursor-pointer min-h-[44px]">
        <input type="checkbox" checked={cfg.enabled}
          onChange={e => onChange({ ...cfg, enabled: e.target.checked })}
          className="accent-[#C9A96E]" />
        <span className="text-sm">Enable failure alerts</span>
      </label>
      <input type="email" placeholder="Email address"
        value={cfg.email ?? ''} className="input-field w-full"
        onChange={e => onChange({ ...cfg, email: e.target.value })} />
      <input type="text" placeholder="WhatsApp number (international)"
        value={cfg.whatsapp ?? ''} className="input-field w-full"
        onChange={e => onChange({ ...cfg, whatsapp: e.target.value })} />
      <input type="url" placeholder="Slack webhook URL"
        value={cfg.slack_webhook ?? ''} className="input-field w-full"
        onChange={e => onChange({ ...cfg, slack_webhook: e.target.value })} />
      <button onClick={onSave}
        className="button-primary">
        Save Alert Settings
      </button>
    </div>
  )
}

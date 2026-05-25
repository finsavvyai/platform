import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

interface SetupData { qr_url: string; secret: string; recovery_codes: string[] }

interface Props {
  setup: SetupData; code: string; onCodeChange: (v: string) => void;
  onVerify: () => void; loading: boolean;
}

export function MFASteps({ setup, code, onCodeChange, onVerify, loading }: Props) {
  return (
    <div className="space-y-lg">
      <Card>
        <p className="sf-headline mb-md sf-title">1. Scan QR Code</p>
        <div className="bg-white p-lg rounded-apple-md inline-block">
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup.qr_url)}`}
            alt="TOTP QR Code" className="w-48 h-48" />
        </div>
        <p className="sf-caption mt-md" style={{ color: 'var(--dash-text-tertiary)' }}>
          Or enter manually: <code style={{ color: 'var(--dash-text-secondary)' }}>{setup.secret}</code>
        </p>
      </Card>

      <Card>
        <p className="sf-headline mb-md sf-title">2. Enter Code</p>
        <input value={code} onChange={e => onCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000" maxLength={6}
          className="input-field w-full text-center text-2xl tracking-[0.5em] font-mono mb-lg" />
        <Button onClick={onVerify} disabled={loading || code.length !== 6} className="w-full">
          {loading ? 'Verifying...' : 'Verify & Enable'}
        </Button>
      </Card>

      <Card>
        <p className="sf-headline mb-md sf-title">3. Save Recovery Codes</p>
        <p className="sf-caption mb-md" style={{ color: 'var(--dash-text-secondary)' }}>
          Store these codes safely. Each can be used once if you lose your authenticator.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          {setup.recovery_codes.map(c => (
            <code key={c} className="text-sm bg-white/5 p-sm rounded font-mono text-center">{c}</code>
          ))}
        </div>
      </Card>
    </div>
  )
}

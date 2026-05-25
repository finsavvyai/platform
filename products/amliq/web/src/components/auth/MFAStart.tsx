import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

interface Props { onStart: () => void; loading: boolean }

export function MFAStart({ onStart, loading }: Props) {
  return (
    <Card>
      <p className="sf-body mb-lg" style={{ color: 'var(--dash-text-secondary)' }}>
        Use an authenticator app (Google Authenticator, Authy, 1Password) to generate time-based codes.
      </p>
      <Button onClick={onStart} disabled={loading} className="w-full">
        {loading ? 'Setting up...' : 'Enable MFA'}
      </Button>
    </Card>
  )
}

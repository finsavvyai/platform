import { PageHeader } from '../layout/PageHeader'
import { Card } from '../ui/Card'

export function MFAVerified() {
  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="MFA Enabled" />
      <Card className="text-center py-xxl">
        <div className="w-16 h-16 rounded-full bg-apple-green/20 flex items-center justify-center mx-auto mb-lg">
          <span className="text-2xl text-apple-green">&#10003;</span>
        </div>
        <p className="sf-headline text-apple-green mt-lg">Two-factor authentication enabled</p>
        <p className="sf-caption mt-sm" style={{ color: 'var(--dash-text-secondary)' }}>
          Your account is now protected with TOTP
        </p>
      </Card>
    </div>
  )
}

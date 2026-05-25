import React from 'react'
import { Shield, Globe, Calendar, AlertTriangle } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import type { PEPProfile } from '../../data/pepProfiles'

const tierColors: Record<string, string> = {
  Tier1: 'red', Tier2: 'orange', Tier3: 'blue', Tier4: 'green',
}

export function PEPResultCard({ profile }: { profile: PEPProfile }) {
  const tierColor = tierColors[profile.tier] || 'gray'

  return (
    <Card className="space-y-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 rounded-full bg-apple-red/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-apple-red" />
          </div>
          <div>
            <h3 className="sf-headline">{profile.name}</h3>
            <p className="sf-caption">{profile.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-sm">
          <Badge color={tierColor as 'red' | 'orange' | 'blue' | 'green'}>{profile.tier}</Badge>
          {profile.isActive ? (
            <Badge color="red">Active</Badge>
          ) : (
            <Badge color="green">Inactive</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-lg">
        <InfoItem icon={Shield} label="Position" value={profile.position} />
        <InfoItem icon={Globe} label="Country" value={profile.country} />
        <InfoItem icon={Calendar} label="Since" value={profile.startDate} />
        <InfoItem icon={AlertTriangle} label="Risk Weight" value={`${(profile.riskWeight * 100).toFixed(0)}%`} />
      </div>

      {profile.aliases.length > 0 && (
        <div>
          <p className="sf-caption mb-sm">Aliases</p>
          <div className="flex flex-wrap gap-sm">
            {profile.aliases.map(a => (
              <span key={a} className="px-md py-xs bg-apple-bg-tertiary rounded-full text-xs">{a}</span>
            ))}
          </div>
        </div>
      )}

      {profile.sanctions.length > 0 && (
        <div>
          <p className="sf-caption mb-sm">Sanctions Lists</p>
          <div className="flex flex-wrap gap-sm">
            {profile.sanctions.map(s => (
              <Badge key={s} color="red">{s}</Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-xs mb-xs">
        <Icon className="w-3 h-3 text-apple-label-secondary" />
        <p className="text-xs text-apple-label-secondary">{label}</p>
      </div>
      <p className="sf-body">{value}</p>
    </div>
  )
}

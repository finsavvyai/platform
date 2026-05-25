import React from 'react'

interface PasswordStrengthProps {
  password: string
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const hasLen = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNum = /\d/.test(password)
  const rules = [
    { ok: hasLen, label: 'At least 8 characters' },
    { ok: hasUpper, label: 'One uppercase letter' },
    { ok: hasNum, label: 'One number' },
  ]
  if (!password) return null
  return (
    <ul className="mt-2 ml-1 space-y-0.5">
      {rules.map(r => (
        <li key={r.label} className="text-xs" style={{ color: r.ok ? '#C9A96E' : 'rgba(250,250,248,0.45)' }}>
          {r.ok ? '\u2713' : '\u2022'} {r.label}
        </li>
      ))}
    </ul>
  )
}

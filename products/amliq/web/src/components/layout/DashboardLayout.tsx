import React from 'react'

interface DashboardLayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
}

export default function DashboardLayout({ children, sidebar }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen" style={{ background: 'var(--dash-bg)' }}>
      {sidebar && (
        <aside className="hidden md:block w-64" style={{ borderInlineEnd: '0.5px solid var(--dash-border)' }}>{sidebar}</aside>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

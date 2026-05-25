import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'MCPOverflow Developer Platform',
  description: 'Create and manage MCP connectors',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
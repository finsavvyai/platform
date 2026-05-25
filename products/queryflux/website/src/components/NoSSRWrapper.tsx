'use client'

import { useEffect, useState } from 'react'

interface NoSSRWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function NoSSRWrapper({ children, fallback = null }: NoSSRWrapperProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

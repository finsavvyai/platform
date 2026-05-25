import React, { useState, useEffect } from 'react'
import { AlertCircle, X, Shield, Clock } from 'lucide-react'
import { SessionManager, SecurityLogger } from '../lib/security'

interface SecurityBannerProps {
  onSessionExpiry?: () => void
  className?: string
}

export function SecurityBanner({ onSessionExpiry, className = '' }: SecurityBannerProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkSessionTime = () => {
      const remaining = SessionManager.getRemainingTime()
      setTimeRemaining(remaining)

      // Show warning if less than 5 minutes remaining
      if (remaining < 5 * 60 * 1000 && remaining > 0 && !dismissed) {
        setShowWarning(true)
      } else if (remaining <= 0) {
        setShowWarning(false)
        onSessionExpiry?.()
      }
    }

    // Check immediately
    checkSessionTime()

    // Check every 30 seconds
    const interval = setInterval(checkSessionTime, 30000)

    return () => clearInterval(interval)
  }, [dismissed, onSessionExpiry])

  const handleDismiss = () => {
    setDismissed(true)
    setShowWarning(false)
    SecurityLogger.logEvent({
      type: 'session_timeout',
      details: {
        action: 'warning_dismissed',
        timeRemaining,
      },
    })
  }

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!showWarning || dismissed) return null

  return (
    <div className={`border-b border-yellow-200 bg-yellow-50 ${className}`}>
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex w-0 flex-1 items-center">
            <span className="flex rounded-lg bg-yellow-100 p-2">
              <Clock className="h-5 w-5 text-yellow-800" aria-hidden="true" />
            </span>
            <p className="ml-3 truncate font-medium text-yellow-700">
              <span className="md:hidden">Session expires soon</span>
              <span className="hidden md:inline">
                Your session will expire in {formatTimeRemaining(timeRemaining)}. Please save your
                work to avoid losing changes.
              </span>
            </p>
          </div>
          <div className="order-2 flex-shrink-0 sm:order-3 sm:ml-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="-mr-1 flex rounded-md p-2 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50 sm:-mr-2"
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-5 w-5 text-yellow-800" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface SecurityIndicatorProps {
  className?: string
}

export function SecurityIndicator({ className = '' }: SecurityIndicatorProps) {
  const [isSecure, setIsSecure] = useState(true)

  useEffect(() => {
    // Check if connection is secure
    setIsSecure(
      window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    )
  }, [])

  if (!isSecure) {
    return (
      <div className={`border-l-4 border-red-400 bg-red-50 p-4 ${className}`}>
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> This connection is not secure. Please use HTTPS for
              security.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 text-green-600 ${className}`}>
      <Shield className="h-4 w-4" />
      <span className="text-xs font-medium">Secure Connection</span>
    </div>
  )
}

interface RateLimitWarningProps {
  resetTime: number
  onDismiss?: () => void
  className?: string
}

export function RateLimitWarning({ resetTime, onDismiss, className = '' }: RateLimitWarningProps) {
  const [timeRemaining, setTimeRemaining] = useState(0)

  useEffect(() => {
    const calculateRemaining = () => {
      const remaining = Math.max(0, resetTime - Date.now())
      setTimeRemaining(remaining)

      if (remaining <= 0) {
        onDismiss?.()
      }
    }

    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)

    return () => clearInterval(interval)
  }, [resetTime, onDismiss])

  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds > 1 ? 's' : ''}`
    }
    return `${seconds} second${seconds > 1 ? 's' : ''}`
  }

  return (
    <div className={`border-l-4 border-blue-400 bg-blue-50 p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm text-blue-700">
            <strong>Rate limit exceeded.</strong> Please wait {formatTimeRemaining(timeRemaining)}{' '}
            before trying again.
          </p>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex rounded-md bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-blue-50"
              >
                <span className="sr-only">Dismiss</span>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SecurityBanner

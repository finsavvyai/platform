'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AuthCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const next = searchParams?.get('next') ?? '/dashboard'
        const error = searchParams?.get('error')

        if (error) {
            // Auth error - redirect to login with error
            router.replace(`/login?error=${error}`)
            return
        }

        // Successful auth - redirect to the app
        // Cloudflare Access handles the JWT automatically
        window.location.href = `https://app.mcpoverflow.io${next}`
    }, [router, searchParams])

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white text-lg">Authenticating...</p>
                <p className="text-gray-500 text-sm mt-2">Redirecting you to the app</p>
            </div>
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    )
}

import { createBrowserClient } from '@supabase/ssr'

// Create Supabase browser client
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

// Auth helper functions
export async function signInWithEmail(email: string, password: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    return { data, error }
}

export async function signUpWithEmail(email: string, password: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
    })
    return { data, error }
}

export async function signInWithOAuth(provider: 'github' | 'google') {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    })
    return { data, error }
}

export async function signOut() {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()
    return { error }
}

export async function getSession() {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
}

export async function getUser() {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
}

// Password reset
export async function resetPassword(email: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { data, error }
}

// Update password
export async function updatePassword(password: string) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.updateUser({
        password,
    })
    return { data, error }
}

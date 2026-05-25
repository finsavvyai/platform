export const LANGUAGE_COLORS: Record<string, string> = {
    TypeScript: 'bg-blue-500',
    JavaScript: 'bg-yellow-500',
    Python: 'bg-green-500',
    Go: 'bg-cyan-500',
    Rust: 'bg-orange-500',
    Java: 'bg-red-500',
    Ruby: 'bg-red-400',
    Swift: 'bg-orange-400',
    Kotlin: 'bg-purple-500',
    'C++': 'bg-pink-500',
    C: 'bg-gray-500',
    PHP: 'bg-indigo-400',
};

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
    missing_params: 'Missing OAuth parameters',
    invalid_state: 'Invalid OAuth state — please try again',
    token_exchange_failed: 'Failed to exchange token with GitHub',
    user_fetch_failed: 'Failed to fetch GitHub user profile',
    db_error: 'Failed to save GitHub connection',
};

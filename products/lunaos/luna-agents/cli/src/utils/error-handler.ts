/**
 * Error Handler — graceful error handling for the Luna CLI
 *
 * Catches common error patterns and provides user-friendly messages
 * with specific fix suggestions.
 */

import chalk from 'chalk';

export interface ErrorContext {
    command?: string;
    provider?: string;
    agent?: string;
    [key: string]: any;
}

interface ErrorPattern {
    /** Test if this pattern matches the error */
    test: (error: Error, ctx: ErrorContext) => boolean;
    /** User-friendly message */
    message: (error: Error, ctx: ErrorContext) => string;
    /** Suggested fix commands/actions */
    suggestions: (error: Error, ctx: ErrorContext) => string[];
}

const ERROR_PATTERNS: ErrorPattern[] = [
    // Missing API key
    {
        test: (e) => /api.key|API_KEY|unauthorized|401/i.test(e.message),
        message: (_, ctx) => `No API key configured${ctx.provider ? ` for ${ctx.provider}` : ''}`,
        suggestions: (_, ctx) => [
            ctx.provider
                ? `luna keys add ${ctx.provider}`
                : 'luna keys add',
            'luna init',
            'Set the API key as an environment variable',
        ],
    },

    // Network / connection errors
    {
        test: (e) => /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed|network|ECONNRESET/i.test(e.message),
        message: () => 'Network connection failed',
        suggestions: () => [
            'Check your internet connection',
            'Verify the API URL is correct: luna config get cloud.apiUrl',
            'Try again — transient network errors are common',
            'Check if a VPN or firewall is blocking the connection',
        ],
    },

    // Rate limiting
    {
        test: (e) => /429|rate.limit|too many requests/i.test(e.message),
        message: () => 'Rate limit exceeded',
        suggestions: () => [
            'Wait a minute and try again',
            'Use a different provider: luna init',
            'Check your plan limits at your provider dashboard',
        ],
    },

    // Invalid agent name
    {
        test: (e) => /agent.*not found|unknown agent|no agent/i.test(e.message),
        message: (_, ctx) => `Agent "${ctx.agent || 'unknown'}" not found`,
        suggestions: (_, ctx) => [
            'luna list  — see all available agents',
            ctx.agent ? `luna list --json | grep "${ctx.agent}"` : '',
            'luna create-agent <name>  — create a custom agent',
        ].filter(Boolean),
    },

    // Not initialized
    {
        test: (e) => /not initialized|config.*not found|ENOENT.*config\.yaml/i.test(e.message),
        message: () => 'LunaOS not initialized in this project',
        suggestions: () => [
            'luna init  — set up LunaOS for this project',
            'luna init --cloud  — connect to LunaOS cloud',
        ],
    },

    // Permission denied
    {
        test: (e) => /EACCES|permission denied/i.test(e.message),
        message: (e) => `Permission denied: ${e.message.split(':').pop()?.trim() || 'file access'}`,
        suggestions: () => [
            'Check file permissions: ls -la .luna/',
            'Ensure you own the directory: sudo chown -R $USER .luna/',
        ],
    },

    // Cloud token missing
    {
        test: (e) => /cloud.*token|not authenticated/i.test(e.message),
        message: () => 'LunaOS cloud authentication required',
        suggestions: () => [
            'luna init --cloud  — sign up or log in',
            'Visit https://agents.lunaos.ai to create an account',
        ],
    },

    // Invalid chain / preset
    {
        test: (e) => /chain.*not found|unknown.*preset|invalid.*chain/i.test(e.message),
        message: (_, ctx) => 'Unknown chain preset',
        suggestions: () => [
            'luna chain --list  — see available chains',
            'Available presets: full-review, new-feature, deploy, security-audit, api-design',
        ],
    },

    // Provider-specific model errors
    {
        test: (e) => /model.*not found|invalid.*model|unsupported.*model/i.test(e.message),
        message: () => 'Invalid or unsupported model',
        suggestions: () => [
            'luna config get model  — check current model',
            'luna config set model <model-name>  — change model',
            'luna init  — reconfigure with a different provider',
        ],
    },

    // Quota exceeded
    {
        test: (e) => /quota|billing|payment|insufficient.*funds|budget/i.test(e.message),
        message: () => 'API quota or billing limit reached',
        suggestions: () => [
            'Check your usage at your provider dashboard',
            'Add billing: visit your provider\'s billing page',
            'Try a free provider: luna init → Google (Gemini) or luna keys add groq',
        ],
    },
];

/**
 * Handle an error with user-friendly output
 * Returns true if it was a known pattern, false for unknown errors
 */
export function handleError(error: Error | unknown, ctx: ErrorContext = {}): boolean {
    const err = error instanceof Error ? error : new Error(String(error));

    // Find matching pattern
    for (const pattern of ERROR_PATTERNS) {
        if (pattern.test(err, ctx)) {
            console.error('');
            console.error(chalk.red(`  ✗ ${pattern.message(err, ctx)}`));
            console.error('');

            const suggestions = pattern.suggestions(err, ctx);
            if (suggestions.length > 0) {
                console.error(chalk.dim('  How to fix:'));
                for (const suggestion of suggestions) {
                    if (suggestion.startsWith('luna ')) {
                        console.error(`    ${chalk.dim('→')} ${chalk.cyan(suggestion)}`);
                    } else {
                        console.error(`    ${chalk.dim('→')} ${chalk.dim(suggestion)}`);
                    }
                }
                console.error('');
            }

            return true;
        }
    }

    // Unknown error — show generic message with debug info
    console.error('');
    console.error(chalk.red(`  ✗ Unexpected error: ${err.message}`));
    console.error('');
    console.error(chalk.dim('  If this persists:'));
    console.error(`    ${chalk.dim('→')} ${chalk.dim('Run with --verbose for more info')}`);
    console.error(`    ${chalk.dim('→')} ${chalk.dim('Report at: https://github.com/lunaos-ai/luna-agents/issues')}`);
    console.error('');

    return false;
}

/**
 * Wrap an async action with error handling
 * Use this to wrap command .action() handlers
 */
export function withErrorHandling(ctx: ErrorContext, fn: () => Promise<void>): () => Promise<void> {
    return async () => {
        try {
            await fn();
        } catch (error) {
            handleError(error, ctx);
            process.exit(1);
        }
    };
}

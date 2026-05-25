import type { Env } from '../worker';
import { executeChain } from './chain-executor';
import { getPresetChain } from '../data/preset-chains';

/**
 * Periodically called by the Cloudflare Worker 'scheduled' event.
 * Queries the `scheduled_tasks` table for any tasks whose cron_schedule implies
 * they should be run now, and dispatches them via the executeChain API.
 */
export async function runScheduledTasks(env: Env): Promise<void> {
    const now = new Date();
    // Use ISO string for standard DB querying
    const currentIso = now.toISOString();

    // In a production system we would parse the `cron_schedule` string (e.g., using `cron-parser`).
    // For this demonstration/prototype phase, we'll execute any task that is active
    // and hasn't been run in the past 10 minutes to prevent overwhelming the LLM APIs.
    // We treat "next_run_at" strictly if available.
    const query = `
        SELECT id, user_id, chain_name, chain_def, context, cron_schedule 
        FROM scheduled_tasks
        WHERE is_active = 1
        AND (last_run_at IS NULL OR datetime(last_run_at, '+10 minutes') <= datetime(?))
        AND (next_run_at IS NULL OR datetime(next_run_at) <= datetime(?))
    `;

    try {
        const { results } = await env.DB.prepare(query).bind(currentIso, currentIso).all<any>();

        if (!results || results.length === 0) {
            console.log(`[ScheduledRunner] No pending tasks found at ${currentIso}.`);
            return;
        }

        console.log(`[ScheduledRunner] Found ${results.length} tasks matching criteria.`);

        for (const task of results) {
            // Run asynchronously in the background so one task doesn't block the runner
            dispatchTask(task, env).catch(err => {
                console.error(`[ScheduledRunner] Task ${task.id} triggered an unhandled error:`, err);
            });
        }
    } catch (err: any) {
        console.error(`[ScheduledRunner] Failed to fetch scheduled tasks:`, err.message);
    }
}

async function dispatchTask(task: any, env: Env): Promise<void> {
    console.log(`[ScheduledRunner] Dispatching Task ${task.id} (Chain: ${task.chain_name})`);

    try {
        // Resolve chain definition
        let chainDef;
        if (task.chain_def) {
            chainDef = JSON.parse(task.chain_def);
        } else {
            chainDef = getPresetChain(task.chain_name);
        }

        if (!chainDef) {
            throw new Error(`Chain definition not found for name: ${task.chain_name}`);
        }

        // Generate Execution ID
        const chainId = crypto.randomUUID();

        // Register the execution in the chain_executions table so the user can track it
        await env.DB.prepare(`
            INSERT INTO chain_executions (id, user_id, chain_name, chain_def, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            chainId,
            task.user_id,
            chainDef.name,
            JSON.stringify(chainDef),
            'running',
            new Date().toISOString(),
        ).run();

        // Fire Execution (Note: no WebSockets/SSE callbacks because this is headless)
        const result = await executeChain(chainDef, task.context || '', env, {
            provider: 'deepseek', // defaulting to deepseek to avoid blowing up bills in detached runs
            model: 'deepseek-chat',
            chainId,
        });

        // Store Final state
        await env.DB.prepare(`
            UPDATE chain_executions
            SET status = ?, duration_ms = ?, node_results = ?, completed_at = ?
            WHERE id = ?
        `).bind(
            result.status,
            result.totalDurationMs,
            JSON.stringify(result.nodes),
            new Date().toISOString(),
            chainId,
        ).run();

        // Update last run time on the scheduled task
        // Ideally we would compute the *real* next cron execution and set next_run_at.
        await env.DB.prepare(`
            UPDATE scheduled_tasks 
            SET last_run_at = ?, updated_at = ?
            WHERE id = ?
        `).bind(new Date().toISOString(), new Date().toISOString(), task.id).run();

        console.log(`[ScheduledRunner] Completed Task ${task.id}. Execution ID: ${chainId} - Status: ${result.status}`);
    } catch (err: any) {
        console.error(`[ScheduledRunner] Failed to dispatch task ${task.id}:`, err.message);
    }
}

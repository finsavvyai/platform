/**
 * Qestro AI Code Review Worker
 * Handles webhook-driven review job creation for Qestro AI review flows.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyGitHubSignature } from './utils/verify';
import type { Env, GitHubWebhookEvent, ReviewJob } from './types';

// Core Logic Export for direct embedding
export async function createReviewJobFromEvent(event: GitHubWebhookEvent): Promise<ReviewJob | null> {
    const { action, pull_request, repository, installation } = event;

    // Only review on: opened, synchronize (new commits), reopened
    if (['opened', 'synchronize', 'reopened'].includes(action)) {
        return {
            id: crypto.randomUUID(),
            type: 'PR_REVIEW',
            prNumber: pull_request.number,
            prTitle: pull_request.title,
            prUrl: pull_request.html_url,
            repoOwner: repository.owner.login,
            repoName: repository.name,
            repoUrl: repository.clone_url,
            prAuthor: pull_request.user.login,
            baseBranch: pull_request.base.ref,
            headBranch: pull_request.head.ref,
            headSha: pull_request.head.sha,
            installationId: installation?.id || 0,
            createdAt: new Date().toISOString()
        };
    }
    return null;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors());

// Health check
app.get('/health', (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'code-review-webhook-handler'
    });
});

// GitHub webhook endpoint
app.post('/webhooks/github', async (c) => {
    try {
        // 1. Verify GitHub signature
        const signature = c.req.header('X-Hub-Signature-256');
        const payload = await c.req.text();

        if (!signature || !verifyGitHubSignature(payload, signature, c.env.GITHUB_WEBHOOK_SECRET)) {
            console.error('Invalid webhook signature');
            return c.json({ error: 'Invalid signature' }, 401);
        }

        // 2. Parse event
        const event: GitHubWebhookEvent = JSON.parse(payload);
        const eventType = c.req.header('X-GitHub-Event');

        console.log(`Received GitHub event: ${eventType}, action: ${event.action}`);

        // 3. Handle pull_request events
        if (eventType === 'pull_request') {
            const reviewJob = await createReviewJobFromEvent(event);
            if (reviewJob) {
                console.log('Queuing review job:', reviewJob);
                // In Cloudflare context: await c.env.REVIEW_QUEUE.send(reviewJob);
                return c.json({
                    message: 'Review queued successfully',
                    reviewId: reviewJob.id,
                    pr: { number: reviewJob.prNumber }
                });
            }
        }

        // 4. Handle pull_request_review_comment events
        if (eventType === 'pull_request_review_comment') {
            // Logic for re-review...
        }

        return c.json({ message: 'Event processed' });
    } catch (error) {
        console.error('Webhook processing error:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

export default app;

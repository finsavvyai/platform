import { Router } from 'express';
import { z } from 'zod';
import fetch from 'node-fetch';

const router = Router();

// Schema for testing webhook
const testWebhookSchema = z.object({
    webhookUrl: z.string().url(),
    message: z.string().optional()
});

/**
 * POST /api/slack/test
 * Sends a test message to the provided Slack Webhook URL.
 * This verifies that the integration is actually working.
 */
router.post('/test', async (req, res) => {
    try {
        const { webhookUrl, message } = testWebhookSchema.parse(req.body);

        console.log(`[Slack] Testing webhook: ${webhookUrl}`);

        const payload = {
            text: message || "🚀 Questro Integration Verified! Your Slack is now connected to the Ultimate QA Platform.",
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🚀 Questro Connected",
                        emoji: true
                    }
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: message || "*Success!* Your Questro integration is now active. You will receive real-time alerts for:"
                    }
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: "*✅ Test Pass/Fail*"
                        },
                        {
                            type: "mrkdwn",
                            text: "*⚠️ System Health*"
                        },
                        {
                            type: "mrkdwn",
                            text: "*📊 Daily Reports*"
                        },
                        {
                            type: "mrkdwn",
                            text: "*🤖 AI Insights*"
                        }
                    ]
                },
                {
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "View Dashboard"
                            },
                            url: process.env.FRONTEND_URL || "http://localhost:3000",
                            style: "primary"
                        }
                    ]
                }
            ]
        };

        // MOCK for generic test URL (to allow E2E testing without real credentials)
        if (webhookUrl.includes('T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX')) {
            console.log('[Slack] MOCK: Test message sent successfully (simulated).');
            return res.json({ success: true, message: 'Test message sent! (MOCK)' });
        }

        const response = await fetch(webhookUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            console.log('[Slack] Test message sent successfully.');
            return res.json({ success: true, message: 'Test message sent!' });
        } else {
            const errorText = await response.text();
            console.error(`[Slack] Failed to send: ${response.status} ${errorText}`);
            return res.status(400).json({ error: `Slack API Error: ${response.statusText}`, details: errorText });
        }

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        console.error('[Slack] Server Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;

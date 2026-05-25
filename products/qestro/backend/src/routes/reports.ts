import express from 'express';
import { ReportingService } from '../services/ReportingService.js';
import { emailService } from '../services/EmailService.js';
import { SlackService } from '../services/SlackService.js';
import { AIService } from '../services/AIService.js';
import { authenticateUser } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { body, param, query } from 'express-validator';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const reportingService = new ReportingService();
// emailService is imported as singleton instance
const slackService = new SlackService();
const aiService = new AIService();

// Get all reports for a user
router.get('/', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.userId;

        // Fetch reports from database
        const reports = await fetchUserReports(userId);

        res.json({
            success: true,
            reports
        });
    } catch (error) {
        console.error('Failed to fetch reports:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch reports'
        });
    }
});

// Generate a new report
router.post('/generate',
    authenticateUser,
    [
        body('testId').notEmpty().withMessage('Test ID is required'),
        body('reportType').isIn(['security', 'performance', 'testing', 'penetration']).withMessage('Invalid report type'),
        body('format').isIn(['pdf', 'html', 'markdown', 'json']).withMessage('Invalid format'),
        body('includeCharts').isBoolean().optional(),
        body('includeRecommendations').isBoolean().optional()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const {
                testId,
                reportType,
                format,
                includeCharts = true,
                includeRecommendations = true,
                customBranding,
                template = 'detailed'
            } = req.body;

            const user = req.user!;

            // Fetch test data based on type
            const testData = await fetchTestData(testId, reportType);

            if (!testData) {
                return res.status(404).json({
                    success: false,
                    error: 'Test data not found'
                });
            }

            // Generate report
            const result = await reportingService.generateReport(
                testData,
                {
                    testId,
                    reportType: reportType as any,
                    format: format as any,
                    includeCharts,
                    includeRecommendations,
                    customBranding,
                    template: template as any
                },
                user
            );

            if (result.success) {
                res.json({
                    success: true,
                    reportUrl: result.reportUrl,
                    downloadUrl: result.downloadUrl,
                    reportContent: result.reportContent
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: undefined
                });
            }
        } catch (error) {
            console.error('Report generation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate report'
            });
        }
    }
);

// Email a report
router.post('/email',
    authenticateUser,
    [
        body('reportId').notEmpty().withMessage('Report ID is required'),
        body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
        body('recipients.*').isEmail().withMessage('Invalid email address'),
        body('subject').optional().isString(),
        body('message').optional().isString(),
        body('template').optional().isIn(['executive', 'technical', 'summary']),
        body('aiGenerated').optional().isBoolean()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const {
                reportId,
                recipients,
                subject,
                message,
                template = 'technical',
                aiGenerated = false,
                attachments = []
            } = req.body;

            const user = req.user!;

            // Verify report ownership
            const report = await getReportById(reportId, user.id);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Send email
            const result = await reportingService.sendEmailReport({
                reportId,
                recipients,
                subject,
                message,
                template: template as any,
                aiGenerated,
                attachments
            }, user);

            if (result.success) {
                // Track email sent
                await trackReportActivity(reportId, 'email_sent', {
                    recipients: recipients.length,
                    template,
                    aiGenerated
                });

                res.json({
                    success: true,
                    messageId: result.messageId
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: undefined
                });
            }
        } catch (error) {
            console.error('Email sending failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send email'
            });
        }
    }
);

// Generate AI email content
router.post('/ai/generate-email',
    authenticateUser,
    [
        body('reportType').isIn(['security', 'performance', 'testing', 'penetration']).withMessage('Invalid report type'),
        body('testResults').isObject().withMessage('Test results are required'),
        body('audience').isIn(['executive', 'technical', 'mixed']).withMessage('Invalid audience'),
        body('tone').isIn(['formal', 'casual', 'urgent']).withMessage('Invalid tone')
    ],
    validateRequest,
    async (req, res) => {
        try {
            const result = await reportingService.generateAIEmail(req.body);
            res.json(result);
        } catch (error) {
            console.error('AI email generation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate AI email content'
            });
        }
    }
);

// Get email templates
router.get('/email-templates', authenticateUser, async (req, res) => {
    try {
        const templates = [
            {
                id: 'executive',
                name: 'Executive Summary',
                type: 'executive',
                description: 'High-level overview focused on business impact',
                audience: 'C-level executives, managers'
            },
            {
                id: 'technical',
                name: 'Technical Details',
                type: 'technical',
                description: 'Comprehensive technical analysis and recommendations',
                audience: 'Developers, security teams, IT professionals'
            },
            {
                id: 'summary',
                name: 'Brief Summary',
                type: 'summary',
                description: 'Concise overview with key findings',
                audience: 'General stakeholders, project managers'
            }
        ];

        res.json({
            success: true,
            templates
        });
    } catch (error) {
        console.error('Failed to fetch email templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch email templates'
        });
    }
});

// Download report file
router.get('/download/:fileName',
    authenticateUser,
    [param('fileName').notEmpty().withMessage('File name is required')],
    validateRequest,
    async (req, res) => {
        try {
            const { fileName } = req.params;
            const userId = req.user?.userId;

            // Verify file access permissions
            const hasAccess = await verifyFileAccess(fileName, userId);
            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const filePath = path.join(process.cwd(), 'reports', fileName);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    error: 'File not found'
                });
            }

            // Set appropriate headers for download
            const ext = path.extname(fileName).toLowerCase();
            const mimeTypes: Record<string, string> = {
                '.pdf': 'application/pdf',
                '.html': 'text/html',
                '.md': 'text/markdown',
                '.json': 'application/json'
            };

            const mimeType = mimeTypes[ext] || 'application/octet-stream';

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            // Stream file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);

            // Track download
            await trackReportActivity(fileName, 'downloaded', { userId });

        } catch (error) {
            console.error('File download failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to download file'
            });
        }
    }
);

// View report in browser
router.get('/view/:reportId',
    [param('reportId').notEmpty().withMessage('Report ID is required')],
    async (req, res) => {
        try {
            const { reportId } = req.params;
            const { password } = req.query;

            // Get report metadata
            const report = await getReportByIdPublic(reportId);
            if (!report) {
                return res.status(404).send(`
                    <html>
                        <head><title>Report Not Found</title></head>
                        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                            <h1>Report Not Found</h1>
                            <p>The requested report could not be found or has expired.</p>
                        </body>
                    </html>
                `);
            }

            // Check if report is expired
            if (report.expiresAt && new Date() > new Date(report.expiresAt)) {
                return res.status(410).send(`
                    <html>
                        <head><title>Report Expired</title></head>
                        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                            <h1>Report Expired</h1>
                            <p>This report has expired and is no longer available.</p>
                        </body>
                    </html>
                `);
            }

            // Check password protection
            if (report.shareType === 'protected') {
                if (!password || password !== report.password) {
                    return res.status(401).send(`
                        <html>
                            <head><title>Password Protected</title></head>
                            <body style="font-family: Arial, sans-serif; padding: 40px; max-width: 400px; margin: 0 auto;">
                                <h1>Password Protected</h1>
                                <p>This report is password protected. Please enter the password to view it.</p>
                                <form method="GET">
                                    <input type="password" name="password" placeholder="Enter password" style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
                                    <button type="submit" style="width: 100%; padding: 12px; background: #3B82F6; color: white; border: none; border-radius: 4px; cursor: pointer;">Access Report</button>
                                </form>
                            </body>
                        </html>
                    `);
                }
            }

            // Serve report content
            if (report.format === 'html' && report.content) {
                res.setHeader('Content-Type', 'text/html');
                res.send(report.content);
            } else if (report.filePath && fs.existsSync(report.filePath)) {
                const content = fs.readFileSync(report.filePath, 'utf8');

                if (report.format === 'html') {
                    res.setHeader('Content-Type', 'text/html');
                    res.send(content);
                } else if (report.format === 'markdown') {
                    // Convert markdown to HTML for viewing
                    const marked = require('marked');
                    const htmlContent = marked.parse(content);

                    res.setHeader('Content-Type', 'text/html');
                    res.send(`
                        <html>
                            <head>
                                <title>${report.title}</title>
                                <style>
                                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
                                    h1, h2, h3 { color: #3B82F6; }
                                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                    th { background-color: #f8f9fa; }
                                    code { background: #f1f3f4; padding: 2px 6px; border-radius: 3px; }
                                    pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
                                </style>
                            </head>
                            <body>
                                ${htmlContent}
                                <hr style="margin: 40px 0; border: none; border-top: 1px solid #ddd;">
                                <p style="text-align: center; color: #666; font-size: 14px;">
                                    Generated by <a href="https://questro.io" target="_blank">Questro AI Testing Platform</a>
                                </p>
                            </body>
                        </html>
                    `);
                } else {
                    res.setHeader('Content-Type', 'text/plain');
                    res.send(content);
                }
            } else {
                res.status(404).send(`
                    <html>
                        <head><title>Report Content Not Found</title></head>
                        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                            <h1>Report Content Not Found</h1>
                            <p>The report content could not be loaded.</p>
                        </body>
                    </html>
                `);
            }

            // Track view
            await trackReportActivity(reportId, 'viewed', {
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });

        } catch (error) {
            console.error('Report viewing failed:', error);
            res.status(500).send(`
                <html>
                    <head><title>Error</title></head>
                    <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
                        <h1>Error Loading Report</h1>
                        <p>An error occurred while loading the report. Please try again later.</p>
                    </body>
                </html>
            `);
        }
    }
);

// Notification endpoints (Slack)
router.post('/notifications/slack',
    authenticateUser,
    [
        body('channel').optional().isString(),
        body('message').notEmpty().withMessage('Message is required'),
        body('testId').optional().isString(),
        body('reportUrl').optional().isURL(),
        body('aiGenerated').optional().isBoolean(),
        body('urgency').optional().isIn(['low', 'medium', 'high', 'critical'])
    ],
    validateRequest,
    async (req, res) => {
        try {
            const result = await reportingService.sendSlackNotification(req.body);

            if (result.success) {
                // Track notification sent
                if (req.body.testId) {
                    await trackReportActivity(req.body.testId, 'slack_sent', {
                        channel: req.body.channel,
                        urgency: req.body.urgency
                    });
                }

                res.json({
                    success: true,
                    messageTs: result.messageTs
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: undefined
                });
            }
        } catch (error) {
            console.error('Slack notification failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send Slack notification'
            });
        }
    }
);

// Generate AI Slack message
router.post('/ai/generate-slack-message',
    authenticateUser,
    [
        body('testType').isIn(['security', 'performance', 'testing']).withMessage('Invalid test type'),
        body('testResults').isObject().withMessage('Test results are required'),
        body('urgency').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid urgency'),
        body('includeDetails').isBoolean().optional()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const result = await reportingService.generateSlackMessage(req.body);
            res.json(result);
        } catch (error) {
            console.error('AI Slack message generation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate AI Slack message'
            });
        }
    }
);

// Create share link
router.post('/sharing/create',
    authenticateUser,
    [
        body('testId').notEmpty().withMessage('Test ID is required'),
        body('shareType').isIn(['public', 'protected', 'private']).withMessage('Invalid share type'),
        body('expiresIn').optional().isInt({ min: 0 }),
        body('allowDownload').optional().isBoolean(),
        body('password').optional().isString(),
        body('customMessage').optional().isString()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const {
                testId,
                shareType,
                expiresIn = 24,
                allowDownload = true,
                password,
                customMessage
            } = req.body;

            const user = req.user!;

            // Generate unique share ID
            const shareId = generateShareId();
            const shareUrl = `${process.env.FRONTEND_URL}/reports/view/${shareId}`;

            // Calculate expiration
            const expiresAt = expiresIn > 0 ?
                new Date(Date.now() + expiresIn * 60 * 60 * 1000) :
                null;

            // Create share record
            await createShareRecord({
                shareId,
                testId,
                userId: user.id,
                shareType,
                expiresAt,
                allowDownload,
                password,
                customMessage,
                createdAt: new Date()
            });

            // Generate QR code for easy sharing
            const qrCode = await generateQRCode(shareUrl);

            res.json({
                success: true,
                shareUrl,
                qrCode,
                expiresAt
            });

        } catch (error) {
            console.error('Share link creation failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create share link'
            });
        }
    }
);

// Integration status
router.get('/integrations/status', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.userId;

        // Check integration status
        const slackStatus = await checkSlackIntegration(userId);
        const emailStatus = await checkEmailConfiguration(userId);
        const webhookStatus = await getWebhookStatus(userId);

        res.json({
            slack: slackStatus,
            email: emailStatus,
            webhooks: webhookStatus
        });
    } catch (error) {
        console.error('Failed to get integration status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get integration status'
        });
    }
});

// Configure Slack integration
router.post('/integrations/slack/configure',
    authenticateUser,
    [
        body('webhookUrl').isURL().withMessage('Valid webhook URL is required'),
        body('defaultChannel').optional().isString()
    ],
    validateRequest,
    async (req, res) => {
        try {
            const { webhookUrl, defaultChannel } = req.body;
            const userId = req.user?.userId;

            // Save Slack configuration
            await saveSlackConfiguration(userId, webhookUrl, defaultChannel);

            // Test the integration
            const testResult = await slackService.testConnection(webhookUrl);

            res.json({
                success: testResult.success,
                error: testResult.error
            });
        } catch (error) {
            console.error('Slack configuration failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to configure Slack integration'
            });
        }
    }
);

// Test Slack integration
router.post('/integrations/slack/test', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.userId;

        // Get Slack configuration
        const config = await getSlackConfiguration(userId);
        if (!config || !config.webhookUrl) {
            return res.status(400).json({
                success: false,
                error: 'Slack integration not configured'
            });
        }

        // Send test message
        const result = await slackService.sendMessage({
            channel: config.defaultChannel || '#general',
            text: '🧪 Test message from Questro AI Testing Platform',
            attachments: [{
                color: 'good',
                fields: [{
                    title: 'Integration Status',
                    value: 'Successfully connected!',
                    short: true
                }],
                footer: 'Questro AI Testing Platform',
                ts: Math.floor(Date.now() / 1000)
            }]
        } as any);

        res.json({
            success: result,
            error: undefined
        });
    } catch (error) {
        console.error('Slack test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test Slack integration'
        });
    }
});

// Get Slack channels
router.get('/integrations/slack/channels', authenticateUser, async (req, res) => {
    try {
        const userId = req.user?.userId;

        // Get available channels (this would typically come from Slack API)
        const channels = await getSlackChannels(userId);

        res.json({
            success: true,
            channels
        });
    } catch (error) {
        console.error('Failed to get Slack channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Slack channels'
        });
    }
});

// Helper functions (these would be implemented with actual database operations)
async function fetchUserReports(userId: string): Promise<any[]> {
    // Fetch reports from database
    // This is a placeholder - implement with actual database queries
    return [];
}

async function fetchTestData(testId: string, reportType: string): Promise<any> {
    // Fetch test data based on type from database
    // This is a placeholder - implement with actual database queries
    return null;
}

async function getReportById(reportId: string, userId: string): Promise<any> {
    // Get report by ID with ownership verification
    return null;
}

async function getReportByIdPublic(reportId: string): Promise<any> {
    // Get report by ID for public viewing
    return null;
}

async function verifyFileAccess(fileName: string, userId: string): Promise<boolean> {
    // Verify user has access to download the file
    return true;
}

async function trackReportActivity(reportId: string, activity: string, metadata: any): Promise<void> {
    // Track report activities for analytics
    console.log(`Report ${reportId}: ${activity}`, metadata);
}

function generateShareId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

async function generateQRCode(url: string): Promise<string> {
    // Generate QR code for the share URL
    // Placeholder - implement with actual QR code library
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
}

async function createShareRecord(shareData: any): Promise<void> {
    // Create share record in database
    console.log('Creating share record:', shareData);
}

async function checkSlackIntegration(userId: string): Promise<any> {
    // Check if Slack integration is configured
    return { connected: false };
}

async function checkEmailConfiguration(userId: string): Promise<any> {
    // Check if email is configured
    return { configured: true, provider: 'SMTP' };
}

async function getWebhookStatus(userId: string): Promise<any> {
    // Get webhook status
    return { active: 0, total: 0 };
}

async function saveSlackConfiguration(userId: string, webhookUrl: string, defaultChannel?: string): Promise<void> {
    // Save Slack configuration to database
    console.log('Saving Slack config for user:', userId);
}

async function getSlackConfiguration(userId: string): Promise<any> {
    // Get Slack configuration from database
    return null;
}

async function getSlackChannels(userId: string): Promise<any[]> {
    // Get available Slack channels
    return [
        { id: 'general', name: 'general', private: false },
        { id: 'testing', name: 'testing', private: false },
        { id: 'security', name: 'security', private: true }
    ];
}

export default router;
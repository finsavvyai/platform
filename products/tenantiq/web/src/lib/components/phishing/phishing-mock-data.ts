import type { PhishingAnalysis } from './phishing-types';

export function getMockPhishingAnalysis(timeRangeHours: number): PhishingAnalysis {
	return {
		threatLevel: 'medium',
		phishingScore: 68,
		activeThreats: [
			{
				id: 'threat-1',
				subject: 'Urgent: Verify your Microsoft account',
				sender: 'security@micros0ft-support.com',
				receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
				threatType: 'Credential Harvesting',
				confidence: 95,
				indicators: [
					'Suspicious sender domain',
					'Urgency language detected',
					'Login link to fake Microsoft page',
					'No SPF/DKIM validation'
				]
			},
			{
				id: 'threat-2',
				subject: 'Invoice #INV-2024-1234',
				sender: 'billing@company-invoice.net',
				receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
				threatType: 'Malware Attachment',
				confidence: 88,
				indicators: [
					'Suspicious attachment: invoice.exe',
					'Domain registered 3 days ago',
					'No previous communication history'
				]
			},
			{
				id: 'threat-3',
				subject: 'CEO: Urgent wire transfer needed',
				sender: 'ceo@yourcompany.co',
				receivedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
				threatType: 'Business Email Compromise',
				confidence: 92,
				indicators: [
					'Display name spoofing',
					'Unusual request pattern',
					'Pressure tactics detected',
					'External sender masked as internal'
				]
			}
		],
		recommendations: [
			{ priority: 'high', action: 'Enable Advanced Threat Protection', impact: 'Blocks 95% of phishing attempts before delivery' },
			{ priority: 'high', action: 'Configure DMARC policy to "reject"', impact: 'Prevents domain spoofing and impersonation attacks' },
			{ priority: 'medium', action: 'Enable Safe Links protection', impact: 'Scans URLs in real-time before user clicks' },
			{ priority: 'medium', action: 'Implement user security awareness training', impact: 'Reduces successful phishing by 70%' },
			{ priority: 'low', action: 'Enable mailbox intelligence', impact: 'Learns user communication patterns to detect anomalies' }
		],
		protectionGaps: [
			{ category: 'Email Authentication', severity: 'critical', description: 'DMARC policy set to "none" - allows domain spoofing' },
			{ category: 'Threat Protection', severity: 'high', description: 'Safe Attachments not enabled for all users' },
			{ category: 'User Training', severity: 'medium', description: 'No documented security awareness program' }
		],
		scannedEmails: 1247,
		timeRange: `Last ${timeRangeHours} hours`
	};
}

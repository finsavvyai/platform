export interface Threat {
	id: string;
	subject: string;
	sender: string;
	receivedAt: string;
	threatType: string;
	confidence: number;
	indicators: string[];
}

export interface PhishingAnalysis {
	threatLevel: 'low' | 'medium' | 'high' | 'critical';
	phishingScore: number;
	activeThreats: Threat[];
	recommendations: Array<{
		priority: 'high' | 'medium' | 'low';
		action: string;
		impact: string;
	}>;
	protectionGaps?: Array<{
		category: string;
		severity: 'critical' | 'high' | 'medium' | 'low';
		description: string;
	}>;
	scannedEmails: number;
	timeRange: string;
}

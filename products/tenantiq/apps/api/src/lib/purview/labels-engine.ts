/**
 * Sensitivity Labels Engine — fetches and analyzes label adoption.
 * Uses Microsoft Graph API for label inventory and scoring.
 */

export interface SensitivityLabel {
	id: string;
	name: string;
	description: string;
	priority: number;
	isActive: boolean;
	scope: string[];
	protection: {
		encryption: boolean;
		contentMarking: boolean;
		autoLabeling: boolean;
	};
}

export interface LabelAdoptionResult {
	totalLabels: number;
	activeLabels: number;
	withEncryption: number;
	withAutoLabeling: number;
	adoptionScore: number;
	recommendations: string[];
}

interface GraphClient {
	fetch(path: string): Promise<any>;
}

/** Fetch sensitivity labels from Microsoft Graph API */
export async function fetchSensitivityLabels(
	graphToken: GraphClient | null,
): Promise<SensitivityLabel[]> {
	if (!graphToken) return [];

	try {
		const data = await graphToken.fetch(
			'/informationProtection/policy/labels',
		);
		const raw = data.value || [];

		return raw.map((l: any, index: number) => ({
			id: l.id || crypto.randomUUID(),
			name: l.name || l.displayName || 'Unnamed Label',
			description: l.description || l.tooltip || '',
			priority: l.priority ?? index,
			isActive: l.isActive !== false,
			scope: extractScope(l),
			protection: {
				encryption: l.isEncryptionEnabled ?? false,
				contentMarking: l.isContentMarkingEnabled ?? false,
				autoLabeling: l.isAutoLabelingEnabled ?? false,
			},
		}));
	} catch {
		return [];
	}
}

function extractScope(label: any): string[] {
	if (Array.isArray(label.scope)) return label.scope;
	const scopes: string[] = [];
	if (label.applicableTo?.includes('file')) scopes.push('Files');
	if (label.applicableTo?.includes('email')) scopes.push('Email');
	if (label.applicableTo?.includes('site')) scopes.push('Sites');
	if (label.applicableTo?.includes('group')) scopes.push('Groups');
	if (scopes.length === 0) scopes.push('All');
	return scopes;
}

/** Analyze label adoption and generate improvement recommendations */
export function analyzeLabelAdoption(
	labels: SensitivityLabel[],
): LabelAdoptionResult {
	const activeLabels = labels.filter((l) => l.isActive).length;
	const withEncryption = labels.filter(
		(l) => l.protection.encryption,
	).length;
	const withAutoLabeling = labels.filter(
		(l) => l.protection.autoLabeling,
	).length;

	const adoptionScore = calculateAdoptionScore(
		labels,
		activeLabels,
		withEncryption,
		withAutoLabeling,
	);
	const recommendations = buildLabelRecommendations(
		labels,
		activeLabels,
		withEncryption,
		withAutoLabeling,
	);

	return {
		totalLabels: labels.length,
		activeLabels,
		withEncryption,
		withAutoLabeling,
		adoptionScore,
		recommendations,
	};
}

function calculateAdoptionScore(
	labels: SensitivityLabel[],
	active: number,
	encrypted: number,
	autoLabeled: number,
): number {
	if (labels.length === 0) return 0;

	let score = 0;
	// Base: having labels at all (up to 30 points)
	score += Math.min(active, 3) * 10;
	// Encryption coverage (up to 30 points)
	score += Math.min(encrypted, 3) * 10;
	// Auto-labeling (up to 20 points)
	score += Math.min(autoLabeled, 2) * 10;
	// Content marking bonus (up to 20 points)
	const withMarking = labels.filter(
		(l) => l.protection.contentMarking,
	).length;
	score += Math.min(withMarking, 2) * 10;

	return Math.min(score, 100);
}

function buildLabelRecommendations(
	labels: SensitivityLabel[],
	active: number,
	encrypted: number,
	autoLabeled: number,
): string[] {
	const recs: string[] = [];

	if (labels.length === 0) {
		recs.push('Create sensitivity labels (Public, Internal, Confidential)');
		recs.push('Enable encryption on Confidential labels');
		recs.push('Configure auto-labeling for PII detection');
		return recs;
	}

	if (active < 3) {
		recs.push(
			'Create at least 3 active labels for proper classification hierarchy',
		);
	}
	if (encrypted === 0) {
		recs.push(
			'Enable encryption on at least one label to protect sensitive content',
		);
	}
	if (autoLabeled === 0) {
		recs.push(
			'Configure auto-labeling to automatically classify sensitive content',
		);
	}

	const withMarking = labels.filter(
		(l) => l.protection.contentMarking,
	).length;
	if (withMarking === 0) {
		recs.push(
			'Add content marking (headers/footers/watermarks) to sensitive labels',
		);
	}

	const inactive = labels.filter((l) => !l.isActive).length;
	if (inactive > 0) {
		recs.push(`Review ${inactive} inactive labels — activate or remove`);
	}

	return recs;
}

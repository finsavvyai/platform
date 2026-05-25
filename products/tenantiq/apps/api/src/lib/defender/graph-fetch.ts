/**
 * Fetch Defender posture inputs from Graph: most-recent secureScores entry
 * + secureScoreControlProfiles. Composed into the scanner.
 *
 * Required Graph permissions: SecurityEvents.Read.All.
 */
import { GraphClient } from '../graph-client';
import type { RawSecureScoreControl, RawSecureScoreControlProfile } from './scanner';

const GRAPH_V1 = 'https://graph.microsoft.com/v1.0';

interface SecureScoresList { value: { controlScores?: RawSecureScoreControl[]; createdDateTime?: string }[] }
interface ProfilesList { value: RawSecureScoreControlProfile[] }

export async function fetchDefenderInventory(graph: GraphClient): Promise<{
	controlProfiles: RawSecureScoreControlProfile[];
	controlScores: RawSecureScoreControl[];
	scoredAt: string | null;
}> {
	const [scores, profiles] = await Promise.all([
		graph.request<SecureScoresList>(`${GRAPH_V1}/security/secureScores?$top=1`)
			.catch(() => ({ value: [] }) as SecureScoresList),
		graph.fetchAll<RawSecureScoreControlProfile>(`${GRAPH_V1}/security/secureScoreControlProfiles?$top=200`)
			.catch(() => [] as RawSecureScoreControlProfile[]),
	]);

	const latest = scores.value?.[0];
	return {
		controlProfiles: profiles ?? [],
		controlScores: latest?.controlScores ?? [],
		scoredAt: latest?.createdDateTime ?? null,
	};
}

/**
 * Custom Agent Resolver — lookup user-created agents from D1
 * Supports A/B testing via weighted prompt variants
 */

export interface ResolvedAgent {
  slug: string;
  name: string;
  systemPrompt: string;
  variantId: string;
  model?: string;
  temperature?: number;
}

export async function resolveCustomAgent(
  db: D1Database,
  userId: string,
  agentSlug: string,
): Promise<ResolvedAgent | null> {
  try {
    const row = await db.prepare(
      'SELECT * FROM custom_agents WHERE (user_id = ? OR is_public = 1) AND slug = ?',
    ).bind(userId, agentSlug).first() as any;

    if (!row) return null;

    let variants: Array<{ id: string; content: string; weight: number }> = [];
    try {
      variants = JSON.parse(row.system_prompt || '[]');
    } catch {
      variants = [{ id: 'v1', content: row.system_prompt, weight: 100 }];
    }

    // A/B selection by weight
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 0), 0);
    let selectedPrompt = variants[0]?.content || '';
    let selectedVariantId = variants[0]?.id || 'v1';

    if (totalWeight > 0 && variants.length > 1) {
      let random = Math.random() * totalWeight;
      for (const v of variants) {
        random -= v.weight || 0;
        if (random <= 0) {
          selectedPrompt = v.content;
          selectedVariantId = v.id;
          break;
        }
      }
    }

    return {
      slug: row.slug,
      name: row.name,
      systemPrompt: selectedPrompt,
      variantId: selectedVariantId,
      model: row.model,
      temperature: row.temperature,
    };
  } catch (err) {
    console.error('Failed to lookup custom agent:', err);
    return null;
  }
}

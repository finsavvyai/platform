/**
 * Server-side skill gating middleware.
 *
 * Checks KV for the tenant's activated skills before allowing
 * access to gated endpoints.  Gracefully degrades: if no skill
 * data exists in KV the request is allowed through (existing
 * tenants keep working).  Foundation skills (dashboard, health)
 * are always free and never gated.
 */

import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app/types';
import { getSelectedTenant } from '../lib/tenant-selector';
import { BASE_SKILLS } from '../routes/tenants/skills-data';

export interface SkillActivation {
	id: string;
	status: 'active' | 'trial' | 'locked';
	activatedAt: string;
	trialEndsAt?: string;
}

const FREE_SKILL_IDS = ['dashboard', 'health'];

function skillMeta(id: string) {
	const s = BASE_SKILLS.find((b) => b.id === id);
	return { name: s?.name ?? id, price: s?.price ?? 0 };
}

export async function getSkillActivations(
	kv: KVNamespace,
	tenantId: string,
): Promise<SkillActivation[] | null> {
	const raw = await kv.get(`skills:${tenantId}`, 'json');
	return (raw as SkillActivation[] | null) ?? null;
}

export async function saveSkillActivations(
	kv: KVNamespace,
	tenantId: string,
	activations: SkillActivation[],
): Promise<void> {
	await kv.put(`skills:${tenantId}`, JSON.stringify(activations));
}

function isSkillActive(
	activations: SkillActivation[],
	skillId: string,
): boolean {
	const entry = activations.find((a) => a.id === skillId);
	if (!entry) return false;
	if (entry.status === 'active') return true;
	if (entry.status === 'trial' && entry.trialEndsAt) {
		return new Date(entry.trialEndsAt).getTime() > Date.now();
	}
	return false;
}

async function checkSkill(
	kv: KVNamespace,
	tenantId: string,
	skillId: string,
): Promise<{ allowed: true } | { allowed: false; name: string; price: number }> {
	if (FREE_SKILL_IDS.includes(skillId)) return { allowed: true };
	const activations = await getSkillActivations(kv, tenantId);
	if (activations === null) return { allowed: true }; // graceful degradation
	if (isSkillActive(activations, skillId)) return { allowed: true };
	return { allowed: false, ...skillMeta(skillId) };
}

/**
 * Middleware that blocks access unless the tenant has the skill
 * active or on a valid trial.  Resolves tenant via X-Tenant-Id
 * header / user context (used by auth-protected routes).
 */
export function requireSkill(skillId: string) {
	return createMiddleware<AppEnv>(async (c, next) => {
		const tenantId = getSelectedTenant(c);
		if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);
		const result = await checkSkill(c.env.KV, tenantId, skillId);
		if (result.allowed) return next();
		return c.json({
			error: `This feature requires the ${result.name} skill`,
			skillId, skillName: result.name,
			price: result.price, upgradeUrl: '/skills',
		}, 403);
	});
}

/**
 * Variant for routes that take tenantId as a URL param (e.g. AI
 * engine routes) instead of reading from user session context.
 */
export function requireSkillByParam(skillId: string, paramName = 'tenantId') {
	return createMiddleware<AppEnv>(async (c, next) => {
		const tenantId = c.req.param(paramName);
		if (!tenantId) return c.json({ error: 'No tenant selected' }, 400);
		const result = await checkSkill(c.env.KV, tenantId, skillId);
		if (result.allowed) return next();
		return c.json({
			error: `This feature requires the ${result.name} skill`,
			skillId, skillName: result.name,
			price: result.price, upgradeUrl: '/skills',
		}, 403);
	});
}

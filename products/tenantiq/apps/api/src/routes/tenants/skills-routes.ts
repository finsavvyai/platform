/**
 * Tenant skill routes: list, activate, deactivate.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../app/types';

export const skillRoutes = new Hono<AppEnv>();

// GET /api/tenants/:id/skills
skillRoutes.get('/:id/skills', async (c) => {
	const { getSkillsData, getSkillRecommendations } = await import('./skills-data');
	const { getSkillActivations } = await import('../../middleware/skill-gate');
	const id = c.req.param('id');
	const baseSkills = getSkillsData(id);
	const activations = await getSkillActivations(c.env.KV, id);

	const skills = baseSkills.map(s => {
		if (!activations) return s;
		const act = activations.find(a => a.id === s.id);
		if (!act) return { ...s, status: 'locked' as const };
		if (act.status === 'trial' && act.trialEndsAt) {
			const remaining = Math.max(0, Math.ceil((new Date(act.trialEndsAt).getTime() - Date.now()) / 86400000));
			if (remaining <= 0) return { ...s, status: 'locked' as const, trialDaysLeft: 0 };
			return { ...s, status: 'trial' as const, trialDaysLeft: remaining };
		}
		return { ...s, status: act.status };
	});
	const recommendations = getSkillRecommendations(id);
	const active = skills.filter(s => s.status === 'active' || s.status === 'trial');
	const monthlySpend = active.reduce((sum, s) => sum + s.price, 0);
	return c.json({ skills, recommendations, summary: { total: skills.length, active: active.length, monthlySpend } });
});

// POST /api/tenants/:id/skills/activate
skillRoutes.post('/:id/skills/activate', async (c) => {
	const { getSkillActivations, saveSkillActivations } = await import('../../middleware/skill-gate');
	const { BASE_SKILLS } = await import('./skills-data');
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => ({})) as { skillId?: string; trial?: boolean };
	if (!body.skillId) return c.json({ error: 'skillId is required' }, 400);
	const meta = BASE_SKILLS.find(s => s.id === body.skillId);
	if (!meta) return c.json({ error: 'Unknown skill' }, 404);

	const existing = (await getSkillActivations(c.env.KV, id)) ?? [];
	const now = new Date().toISOString();
	const filtered = existing.filter(a => a.id !== body.skillId);

	if (body.trial) {
		const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString();
		filtered.push({ id: body.skillId, status: 'trial', activatedAt: now, trialEndsAt: trialEnd });
	} else {
		filtered.push({ id: body.skillId, status: 'active', activatedAt: now });
	}

	await saveSkillActivations(c.env.KV, id, filtered);
	return c.json({ success: true, skill: body.skillId, status: body.trial ? 'trial' : 'active' });
});

// POST /api/tenants/:id/skills/deactivate
skillRoutes.post('/:id/skills/deactivate', async (c) => {
	const { getSkillActivations, saveSkillActivations } = await import('../../middleware/skill-gate');
	const id = c.req.param('id');
	const body = await c.req.json().catch(() => ({})) as { skillId?: string };
	if (!body.skillId) return c.json({ error: 'skillId is required' }, 400);

	const existing = (await getSkillActivations(c.env.KV, id)) ?? [];
	const updated = existing.map(a => a.id === body.skillId ? { ...a, status: 'locked' as const } : a);
	await saveSkillActivations(c.env.KV, id, updated);
	return c.json({ success: true, skill: body.skillId, status: 'locked' });
});

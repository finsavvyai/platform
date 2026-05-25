import { describe, it, expect } from 'vitest';
import { ALL_TEMPLATES, findTemplateById, findTemplatesByCategory } from './index';
import { isValidStepChain } from '../../../../../../packages/shared/src/types/workflow-dsl';

describe('Workflow Template Library', () => {
	it('should have exactly 25 templates', () => {
		expect(ALL_TEMPLATES.length).toBe(25);
	});

	it('should cover all 4 categories', () => {
		const categories = new Set(ALL_TEMPLATES.map((t) => t.category));
		expect(categories).toEqual(new Set(['license', 'security', 'lifecycle', 'governance']));
	});

	it('should have 7 license templates', () => {
		expect(findTemplatesByCategory('license').length).toBe(7);
	});

	it('should have 6 security templates', () => {
		expect(findTemplatesByCategory('security').length).toBe(6);
	});

	it('should have 6 lifecycle templates', () => {
		expect(findTemplatesByCategory('lifecycle').length).toBe(6);
	});

	it('should have 6 governance templates', () => {
		expect(findTemplatesByCategory('governance').length).toBe(6);
	});

	it('should have no duplicate IDs', () => {
		const ids = ALL_TEMPLATES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('should have valid step chains for all templates', () => {
		for (const template of ALL_TEMPLATES) {
			expect(template.steps.length).toBeGreaterThanOrEqual(2);
			expect(isValidStepChain(template.steps)).toBe(true);
		}
	});

	it('should require all templates to have tags and estimated duration', () => {
		for (const template of ALL_TEMPLATES) {
			expect(template.tags.length).toBeGreaterThan(0);
			expect(template.estimatedDurationMinutes).toBeGreaterThan(0);
			expect(template.name.length).toBeGreaterThan(0);
			expect(template.description.length).toBeGreaterThan(0);
		}
	});

	it('should find template by ID', () => {
		const template = findTemplateById('disable-risky-user');
		expect(template).toBeDefined();
		expect(template?.category).toBe('security');
	});

	it('should return undefined for unknown ID', () => {
		expect(findTemplateById('nonexistent')).toBeUndefined();
	});
});

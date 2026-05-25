import type { WorkflowTemplate, TemplateCategory } from '../../../../../../packages/shared/src/types/workflow-dsl';
import { LICENSE_TEMPLATES } from './license';
import { SECURITY_TEMPLATES } from './security';
import { LIFECYCLE_TEMPLATES } from './lifecycle';
import { GOVERNANCE_TEMPLATES } from './governance';

export const ALL_TEMPLATES: WorkflowTemplate[] = [
	...LICENSE_TEMPLATES,
	...SECURITY_TEMPLATES,
	...LIFECYCLE_TEMPLATES,
	...GOVERNANCE_TEMPLATES,
];

export function findTemplateById(id: string): WorkflowTemplate | undefined {
	return ALL_TEMPLATES.find((t) => t.id === id);
}

export function findTemplatesByCategory(category: TemplateCategory): WorkflowTemplate[] {
	return ALL_TEMPLATES.filter((t) => t.category === category);
}

export { LICENSE_TEMPLATES, SECURITY_TEMPLATES, LIFECYCLE_TEMPLATES, GOVERNANCE_TEMPLATES };

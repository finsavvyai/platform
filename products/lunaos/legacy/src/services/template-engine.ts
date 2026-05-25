// Template system: React, Next.js, Express scaffolds
export type TemplateType =
  | 'react-component'
  | 'next-page'
  | 'express-api'
  | 'react-form'
  | 'next-layout';

export interface Template {
  id: string;
  type: TemplateType;
  name: string;
  content: string;
  variables: string[];
  created: Date;
}

export class TemplateEngine {
  private templates: Map<string, Template> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    this.createTemplate('react-component', 'Basic Component', `import React from 'react';

interface Props {
  {PROPS}
}

export const {COMPONENT_NAME}: React.FC<Props> = ({ {PROPS} }) => {
  return (
    <div>
      {/* Component content */}
    </div>
  );
};

export default {COMPONENT_NAME};`);

    this.createTemplate('next-page', 'Next.js Page', `import React from 'react';

export default function {PAGE_NAME}() {
  return (
    <main>
      <h1>{PAGE_TITLE}</h1>
      {/* Page content */}
    </main>
  );
}`);

    this.createTemplate('express-api', 'Express Route', `import express from 'express';

const router = express.Router();

router.{METHOD}('{PATH}', (req, res) => {
  // Handle {METHOD} {PATH}
  res.json({ message: '{MESSAGE}' });
});

export default router;`);
  }

  private createTemplate(type: TemplateType, name: string, content: string): Template {
    const template: Template = {
      id: `tpl_${Date.now()}`,
      type,
      name,
      content,
      variables: this.extractVariables(content),
      created: new Date(),
    };

    this.templates.set(template.id, template);
    return template;
  }

  private extractVariables(content: string): string[] {
    const regex = /{([A-Z_]+)}/g;
    const matches = content.match(regex);
    return matches ? matches.map((m) => m.slice(1, -1)) : [];
  }

  addTemplate(type: TemplateType, name: string, content: string): Template {
    return this.createTemplate(type, name, content);
  }

  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getTemplatesByType(type: TemplateType): Template[] {
    return Array.from(this.templates.values()).filter((t) => t.type === type);
  }

  render(id: string, variables: Record<string, string>): string | null {
    const template = this.templates.get(id);
    if (!template) return null;

    let output = template.content;

    Object.entries(variables).forEach(([key, value]) => {
      output = output.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return output;
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  listTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  cloneTemplate(sourceId: string, newName: string): Template | undefined {
    const source = this.templates.get(sourceId);
    if (!source) return undefined;

    return this.createTemplate(source.type, newName, source.content);
  }

  validateVariables(id: string, provided: Record<string, string>): string[] {
    const template = this.templates.get(id);
    if (!template) return [];

    const missing: string[] = [];
    template.variables.forEach((variable) => {
      if (!provided[variable]) {
        missing.push(variable);
      }
    });

    return missing;
  }
}

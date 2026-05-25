// Code generator: generate(prompt, framework) -> GeneratedCode
export type Framework = 'react' | 'next' | 'express' | 'fastapi' | 'django';

export interface GeneratedCode {
  id: string;
  prompt: string;
  framework: Framework;
  code: string;
  components: string[];
  dependencies: string[];
  createdAt: Date;
  estimatedTime: number; // in minutes
}

export class CodeGenerator {
  private generated: Map<string, GeneratedCode> = new Map();
  private templates: Map<Framework, string> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.templates.set('react', this.getReactTemplate());
    this.templates.set('next', this.getNextTemplate());
    this.templates.set('express', this.getExpressTemplate());
  }

  async generate(prompt: string, framework: Framework): Promise<GeneratedCode> {
    const startTime = Date.now();

    const template = this.templates.get(framework) || this.getDefaultTemplate();
    const components = this.extractComponents(prompt);
    const dependencies = this.determineDependencies(framework, components);

    const code = this.buildCode(template, components, prompt);

    const generated: GeneratedCode = {
      id: `gen_${Date.now()}`,
      prompt,
      framework,
      code,
      components,
      dependencies,
      createdAt: new Date(),
      estimatedTime: Math.ceil((Date.now() - startTime) / 60000) || 1,
    };

    this.generated.set(generated.id, generated);
    return generated;
  }

  private extractComponents(prompt: string): string[] {
    const keywords = [
      'button',
      'form',
      'modal',
      'card',
      'list',
      'table',
      'navbar',
      'footer',
      'header',
      'sidebar',
    ];
    const components: string[] = [];

    keywords.forEach((keyword) => {
      if (prompt.toLowerCase().includes(keyword)) {
        components.push(
          keyword.charAt(0).toUpperCase() + keyword.slice(1) + 'Component'
        );
      }
    });

    return components.length > 0 ? components : ['MainComponent'];
  }

  private determineDependencies(framework: Framework, components: string[]): string[] {
    const baseDeps: Record<Framework, string[]> = {
      react: ['react', 'react-dom'],
      next: ['next', 'react', 'react-dom'],
      express: ['express', 'body-parser'],
      fastapi: ['fastapi', 'uvicorn'],
      django: ['django', 'djangorestframework'],
    };

    return baseDeps[framework] || [];
  }

  private buildCode(template: string, components: string[], prompt: string): string {
    let code = template;

    // Replace placeholders
    code = code.replace('{COMPONENT_LIST}', components.join(', '));
    code = code.replace('{DESCRIPTION}', prompt);

    // Add component stubs
    components.forEach((comp) => {
      code += `\n\n// Component: ${comp}\nconst ${comp} = () => {\n  return <div>${comp}</div>;\n};`;
    });

    return code;
  }

  private getReactTemplate(): string {
    return `import React from 'react';

export const App = () => {
  // Components: {COMPONENT_LIST}
  // Purpose: {DESCRIPTION}

  return (
    <div className="app">
      {/* Main content */}
    </div>
  );
};

export default App;`;
  }

  private getNextTemplate(): string {
    return `import React from 'react';

export default function Page() {
  // Components: {COMPONENT_LIST}
  // Purpose: {DESCRIPTION}

  return (
    <main>
      {/* Main content */}
    </main>
  );
}`;
  }

  private getExpressTemplate(): string {
    return `import express from 'express';

const app = express();
// Components: {COMPONENT_LIST}
// Purpose: {DESCRIPTION}

app.get('/', (req, res) => {
  res.json({ message: 'API ready' });
});

export default app;`;
  }

  private getDefaultTemplate(): string {
    return `// Generated code
// Purpose: {DESCRIPTION}
// Components: {COMPONENT_LIST}

function main() {
  // Implementation here
}`;
  }

  getGenerated(id: string): GeneratedCode | undefined {
    return this.generated.get(id);
  }

  listGenerated(): GeneratedCode[] {
    return Array.from(this.generated.values());
  }

  deleteGenerated(id: string): boolean {
    return this.generated.delete(id);
  }
}

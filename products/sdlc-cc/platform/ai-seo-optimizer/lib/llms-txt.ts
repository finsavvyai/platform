import type { LlmsTxtConfig } from './types';

export function generateLlmsTxt(config: LlmsTxtConfig): string {
  const lines: string[] = [];

  lines.push(`# ${config.title}`);
  lines.push('');
  lines.push(`> ${config.description}`);
  lines.push('');

  for (const section of config.sections) {
    lines.push(`## ${section.heading}`);
    lines.push('');
    for (const link of section.links) {
      lines.push(`- [${link.title}](${link.url}): ${link.description}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function parseLlmsTxt(content: string): LlmsTxtConfig {
  const lines = content.split('\n');
  let title = '';
  let description = '';
  const sections: LlmsTxtConfig['sections'] = [];
  let currentSection: LlmsTxtConfig['sections'][number] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      title = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith('> ')) {
      description = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: trimmed.slice(3).trim(), links: [] };
      continue;
    }

    const linkMatch = trimmed.match(/^-\s*\[(.+?)]\((.+?)\):\s*(.+)$/);
    if (linkMatch && currentSection) {
      currentSection.links.push({
        title: linkMatch[1],
        url: linkMatch[2],
        description: linkMatch[3],
      });
    }
  }

  if (currentSection) sections.push(currentSection);

  return { title, description, sections };
}

export const defaultConfig: LlmsTxtConfig = {
  title: 'Your Site Name',
  description: 'A brief description of your site and what it offers.',
  sections: [
    {
      heading: 'Main Pages',
      links: [
        {
          title: 'Homepage',
          url: 'https://example.com/',
          description: 'Main landing page with overview of products and services.',
        },
        {
          title: 'About',
          url: 'https://example.com/about',
          description: 'Company background, team, and mission statement.',
        },
      ],
    },
    {
      heading: 'Documentation',
      links: [
        {
          title: 'Getting Started',
          url: 'https://example.com/docs/getting-started',
          description: 'Quick start guide for new users.',
        },
        {
          title: 'API Reference',
          url: 'https://example.com/docs/api',
          description: 'Complete API documentation with examples.',
        },
      ],
    },
  ],
};

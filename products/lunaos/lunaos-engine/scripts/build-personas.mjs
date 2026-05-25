#!/usr/bin/env node
/**
 * Build script: Extract agent persona system prompts from markdown files
 * and generate a TypeScript data file for the Worker to import.
 *
 * Usage: node scripts/build-personas.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const AGENTS_DIR = join(import.meta.dirname, '../../luna-agents/agents');
const OUTPUT_FILE = join(import.meta.dirname, '../packages/api/src/data/personas.ts');

function extractPersona(filePath) {
    const content = readFileSync(filePath, 'utf-8');

    // Extract name from first H1
    const nameMatch = content.match(/^# (.+)$/m);
    const name = nameMatch ? nameMatch[1].replace(/^Luna\s+/, '').trim() : '';

    // Extract role from ## Role section
    const roleMatch = content.match(/## Role\n([\s\S]*?)(?=\n## )/);
    const role = roleMatch ? roleMatch[1].trim() : '';

    // Build slug from filename
    const filename = basename(filePath, '.md');
    const slug = filename.replace(/^luna-/, '');

    // Determine category
    let category = 'solution';
    if (['code-review', 'testing-validation', 'documentation', 'seo', 'ui-fix', 'ui-test'].includes(slug)) {
        category = 'code-quality';
    } else if (['deployment', 'docker', 'cloudflare', 'monitoring-observability', 'run'].includes(slug)) {
        category = 'devops';
    } else if (['requirements-analyzer', 'design-architect', 'task-planner', 'task-executor', 'api-generator', 'database'].includes(slug)) {
        category = 'planning';
    }

    // Build system prompt (first 4000 chars for the Worker)
    const systemPrompt = content.slice(0, 4000);

    return { slug, name, role, category, systemPrompt };
}

// Read all agent files
const agentFiles = readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();

const personas = [];
for (const file of agentFiles) {
    try {
        const persona = extractPersona(join(AGENTS_DIR, file));
        personas.push(persona);
        console.log(`  ✓ ${persona.slug} — ${persona.name}`);
    } catch (err) {
        console.log(`  ✗ ${file}: ${err.message}`);
    }
}

// Generate TypeScript file
const tsContent = `/**
 * Agent Personas — auto-generated from luna-agents/agents/*.md
 * Run: node scripts/build-personas.mjs
 * Generated: ${new Date().toISOString()}
 */

export interface AgentPersona {
  slug: string;
  name: string;
  role: string;
  category: string;
  systemPrompt: string;
}

export const PERSONAS: AgentPersona[] = ${JSON.stringify(personas, null, 2)};

export function getPersona(slug: string): AgentPersona | undefined {
  return PERSONAS.find(p => p.slug === slug);
}

export function listPersonas(): AgentPersona[] {
  return PERSONAS;
}
`;

// Ensure data dir exists
mkdirSync(dirname(OUTPUT_FILE), { recursive: true });

writeFileSync(OUTPUT_FILE, tsContent, 'utf-8');
console.log(`\n✅ Generated ${OUTPUT_FILE}`);
console.log(`   ${personas.length} agent personas bundled`);

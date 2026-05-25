/** Minimal Mustache-style prompt template expander.
 *
 * Supports:
 *   {{var}}          — required; missing throws
 *   {{var?}}         — optional; missing -> ""
 *   {{var|default}}  — fallback when missing
 *
 * No nested blocks, no loops, no conditionals — keep it auditable.
 */

const VAR = /\{\{\s*([a-zA-Z_][\w.]*)(\?|)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g;

export class TemplateError extends Error {
  constructor(public missing: string[]) {
    super(`missing template variables: ${missing.join(', ')}`);
    this.name = 'TemplateError';
  }
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}

/** Expand `{{var}}` placeholders. Throws TemplateError if required vars missing. */
export function expandTemplate(template: string, vars: Record<string, unknown>): string {
  const missing: string[] = [];
  const result = template.replace(VAR, (_full, name: string, q: string, def: string | undefined) => {
    const v = getPath(vars, name);
    if (v === undefined || v === null) {
      if (q === '?') return '';
      if (def !== undefined) return def;
      missing.push(name);
      return '';
    }
    return String(v);
  });
  if (missing.length) throw new TemplateError(missing);
  return result;
}

/** Extract the variable names a template references. */
export function extractVariables(template: string): string[] {
  const out = new Set<string>();
  for (const m of template.matchAll(VAR)) out.add(m[1]);
  return [...out];
}

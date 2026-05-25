/**
 * Agent Booster — deterministic code transforms that skip the LLM entirely.
 *
 * When a user sends a simple transform intent (e.g. "replace var with const"),
 * this module handles it locally in <1ms instead of calling the LLM.
 */

export interface BoostResult {
  boosted: boolean;
  output?: string;
  transform?: string;
  durationMs?: number;
}

type TransformFn = (code: string) => string;

/** Intent patterns mapped to transform keys */
const INTENT_PATTERNS: Array<{ pattern: RegExp; transform: string }> = [
  { pattern: /\b(var.to.const|replace.var|convert.var)\b/i, transform: 'var-to-const' },
  { pattern: /\b(add.types?|type.annot|add.typescript)\b/i, transform: 'add-types' },
  { pattern: /\b(remove.console|strip.console|delete.console)\b/i, transform: 'remove-console' },
  { pattern: /\b(add.error.handl|try.catch|wrap.try)\b/i, transform: 'add-error-handling' },
  { pattern: /\b(format.json|pretty.print|prettify.json)\b/i, transform: 'format-json' },
  { pattern: /\b(to.async|async.await|convert.then|replace.then)\b/i, transform: 'to-async' },
];

/** Replace `var` declarations with `const` (or `let` if reassigned) */
function varToConst(code: string): string {
  const reassigned = new Set<string>();
  const assignPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?:\+|-)?\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = assignPattern.exec(code)) !== null) {
    reassigned.add(match[1]);
  }

  return code.replace(/\bvar\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g, (full, name) => {
    const occurrences = code.split(new RegExp(`\\b${name}\\s*=`)).length - 1;
    const keyword = occurrences > 1 ? 'let' : 'const';
    return `${keyword} ${name}`;
  });
}

/** Add basic type annotations to untyped function params */
function addTypes(code: string): string {
  return code.replace(
    /function\s+(\w+)\s*\(([^)]*)\)/g,
    (_match, name, params) => {
      const typed = params
        .split(',')
        .filter((p: string) => p.trim())
        .map((p: string) => {
          const trimmed = p.trim();
          if (trimmed.includes(':')) return trimmed;
          return inferParamType(trimmed, code);
        })
        .join(', ');
      return `function ${name}(${typed})`;
    },
  );
}

/** Infer a simple type from usage patterns */
function inferParamType(param: string, code: string): string {
  const name = param.replace(/=.*/, '').trim();
  if (/\.length|\.split|\.trim|\.replace|\.match/.test(findUsage(name, code))) {
    return `${name}: string`;
  }
  if (/\.toFixed|\.toPrecision|\+\+|--|\*|\/\s/.test(findUsage(name, code))) {
    return `${name}: number`;
  }
  if (/\.push|\.pop|\.map|\.filter|\.forEach/.test(findUsage(name, code))) {
    return `${name}: unknown[]`;
  }
  return `${name}: unknown`;
}

function findUsage(name: string, code: string): string {
  const regex = new RegExp(`\\b${name}\\b[^;\\n]{0,60}`, 'g');
  return (code.match(regex) || []).join(' ');
}

/** Strip console.log/warn/error statements */
function removeConsole(code: string): string {
  return code.replace(/^\s*console\.(log|warn|error|info|debug)\s*\([^)]*\);?\s*$/gm, '');
}

/** Wrap function bodies in try/catch */
function addErrorHandling(code: string): string {
  return code.replace(
    /(function\s+\w+\s*\([^)]*\)\s*\{)([\s\S]*?)(\n\})/g,
    (_match, head, body, tail) => {
      if (body.includes('try {')) return _match;
      const indent = '  ';
      const indentedBody = body
        .split('\n')
        .map((l: string) => (l.trim() ? `${indent}${l}` : l))
        .join('\n');
      return `${head}\n  try {${indentedBody}\n  } catch (err) {\n    throw err;\n  }${tail}`;
    },
  );
}

/** Pretty-print JSON */
function formatJson(code: string): string {
  try {
    const parsed = JSON.parse(code);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return code.replace(/,\s*"/g, ',\n  "').replace(/\{/g, '{\n  ').replace(/\}/g, '\n}');
  }
}

/** Convert .then() chains to async/await */
function toAsync(code: string): string {
  let result = code;
  result = result.replace(
    /(\w+)\s*\.\s*then\s*\(\s*(?:async\s*)?\(?\s*(\w+)\s*\)?\s*=>\s*\{/g,
    'const $2 = await $1;\n{',
  );
  result = result.replace(
    /(\w+)\s*\.\s*then\s*\(\s*(?:async\s*)?\(?\s*(\w+)\s*\)?\s*=>\s*([^{].*)\)/g,
    'const $2 = await $1;\n$3',
  );
  result = result.replace(
    /\.catch\s*\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*/g,
    '} catch ($1) { ',
  );
  return result;
}

const TRANSFORMS: Record<string, TransformFn> = {
  'var-to-const': varToConst,
  'add-types': addTypes,
  'remove-console': removeConsole,
  'add-error-handling': addErrorHandling,
  'format-json': formatJson,
  'to-async': toAsync,
};

/** Detect transform intent from the agent slug or context prefix */
function detectIntent(agent: string, context: string): string | null {
  const combined = `${agent} ${context.slice(0, 200)}`;
  for (const { pattern, transform } of INTENT_PATTERNS) {
    if (pattern.test(combined)) return transform;
  }
  return null;
}

/** Extract code block from context (after the intent description) */
function extractCode(context: string): string {
  const codeBlockMatch = context.match(/```[\w]*\n([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const lines = context.split('\n');
  const codeStart = lines.findIndex((l) => /^\s*(var |let |const |function |import |export |{|\[)/.test(l));
  return codeStart >= 0 ? lines.slice(codeStart).join('\n') : context;
}

/**
 * Try to boost the request with a deterministic transform.
 * Returns { boosted: false } if no matching transform is found.
 */
export function tryBoost(agent: string, context: string): BoostResult {
  const intent = detectIntent(agent, context);
  if (!intent || !TRANSFORMS[intent]) return { boosted: false };

  const start = performance.now();
  const code = extractCode(context);
  const output = TRANSFORMS[intent](code);
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  if (output === code) return { boosted: false };

  return { boosted: true, output, transform: intent, durationMs };
}

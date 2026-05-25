/**
 * Context Packer — Trim context before sending to LLM
 * Reduces token usage by 40-60% by removing irrelevant information
 */

export interface PackedContext {
  original: string;
  packed: string;
  tokensSaved: number;
  compressionRatio: number;
}

const NOISE_PATTERNS = [
  /\/\*[\s\S]*?\*\//g,                    // Block comments
  /\/\/.*$/gm,                             // Line comments
  /^\s*\n/gm,                              // Empty lines
  /console\.(log|debug|trace)\([^)]*\);?\s*/g, // Debug statements
  /import\s+type\s+\{[^}]+\}\s+from\s+'[^']+';?\s*/g, // Type-only imports
  /^\s*\/\/ eslint-disable.*$/gm,          // ESLint directives
  /^\s*\/\/ @ts-.*$/gm,                    // TypeScript directives
];

const SIMPLIFICATION_RULES: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  // Collapse multi-line object spreads
  { pattern: /\{\s*\.\.\.\w+,?\s*\}/g, replacement: '{...}' },
  // Simplify long string literals
  { pattern: /"[^"]{100,}"/g, replacement: '"..."' },
  { pattern: /'[^']{100,}'/g, replacement: "'...'" },
  // Collapse repetitive array items
  { pattern: /(\[(?:[^[\]]*?,\s*){5,})[^[\]]*?\]/g, replacement: '$1...]' },
];

export function packContext(
  input: string,
  options: { aggressive?: boolean } = {},
): PackedContext {
  let packed = input;

  // Remove noise
  for (const pattern of NOISE_PATTERNS) {
    packed = packed.replace(pattern, '');
  }

  // Apply simplifications
  if (options.aggressive) {
    for (const rule of SIMPLIFICATION_RULES) {
      packed = packed.replace(rule.pattern, rule.replacement);
    }
  }

  // Collapse excessive whitespace
  packed = packed.replace(/\n{3,}/g, '\n\n');
  packed = packed.replace(/[ \t]+$/gm, '');

  const originalTokens = estimateTokens(input);
  const packedTokens = estimateTokens(packed);

  return {
    original: input,
    packed,
    tokensSaved: originalTokens - packedTokens,
    compressionRatio: packedTokens / originalTokens,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Pack test code context — specialized for Qestro test generation
 * Keeps test structure, removes implementation details
 */
export function packTestContext(
  sourceCode: string,
  testCode: string,
): { source: string; test: string; tokensSaved: number } {
  const packedSource = packContext(sourceCode, { aggressive: true });
  const packedTest = packContext(testCode);

  return {
    source: packedSource.packed,
    test: packedTest.packed,
    tokensSaved: packedSource.tokensSaved + packedTest.tokensSaved,
  };
}

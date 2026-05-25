/** CLI command parser — tokenizes and extracts args, flags */

export interface ParsedCommand {
  command: string;
  args: Record<string, any>;
  flags: Record<string, boolean>;
  positional: string[];
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; } else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ') {
      if (current) { tokens.push(current); current = ''; }
    } else { current += ch; }
  }
  if (current) tokens.push(current);
  return tokens;
}

function isNumeric(val: string): boolean {
  return !isNaN(Number(val)) && val.trim() !== '';
}

/** Parse a raw CLI command string into structured parts */
export function parseCommand(input: string): ParsedCommand {
  const tokens = tokenize(input.trim());
  const args: Record<string, any> = {};
  const flags: Record<string, boolean> = {};
  const positional: string[] = [];
  const commandParts: string[] = [];
  let i = 0;

  // Collect command parts (non-flag tokens at start)
  while (i < tokens.length && !tokens[i].startsWith('-')) {
    commandParts.push(tokens[i]);
    i++;
  }

  // Extract remaining positional from command parts (first 2 are the command)
  const command = commandParts.slice(0, 2).join(' ');
  positional.push(...commandParts.slice(2));

  // Parse flags and named args
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = tokens[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = isNumeric(next) ? Number(next) : next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else if (token.startsWith('-') && token.length === 2) {
      flags[token.slice(1)] = true;
      i++;
    } else {
      positional.push(token);
      i++;
    }
  }

  return { command, args, flags, positional };
}

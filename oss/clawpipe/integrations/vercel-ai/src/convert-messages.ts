/**
 * Converts Vercel AI SDK prompt messages to a plain text prompt
 * suitable for the ClawPipe pipeline.
 */
import type { LanguageModelV1Prompt } from '@ai-sdk/provider';

/** Extract system message from the prompt array. */
export function extractSystem(
  prompt: LanguageModelV1Prompt,
): string | undefined {
  for (const msg of prompt) {
    if (msg.role === 'system') return msg.content;
  }
  return undefined;
}

/** Convert structured prompt messages to a single string. */
export function convertPromptToText(
  prompt: LanguageModelV1Prompt,
): string {
  const parts: string[] = [];

  for (const msg of prompt) {
    if (msg.role === 'system') continue;

    if (msg.role === 'user') {
      const text = extractUserText(msg.content);
      if (text) parts.push(text);
    } else if (msg.role === 'assistant') {
      const text = extractAssistantText(msg.content);
      if (text) parts.push(`Assistant: ${text}`);
    }
  }

  return parts.join('\n\n');
}

function extractUserText(
  content: LanguageModelV1Prompt[number] extends { content: infer C }
    ? C
    : never,
): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return (content as Array<{ type: string; text?: string }>)
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
    .join('\n');
}

function extractAssistantText(
  content: unknown,
): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return (content as Array<{ type: string; text?: string }>)
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text!)
    .join('\n');
}

export const BUILTIN_TEMPLATES: Record<string, string> = {
  'code-review': `You are a code reviewer. Review the following code and provide constructive feedback:

{{code}}

Focus on:
- Code quality and readability
- Performance implications
- Security concerns
- Testing coverage`,

  summarize: `Summarize the following text concisely:

{{text}}

Provide a summary in 2-3 sentences.`,

  'extract-json': `Extract structured data from the following text and return as JSON:

{{text}}

Return valid JSON only.`,
};

export function createTemplate(
  name: string,
  template: string
): (variables: Record<string, string>) => string {
  return (variables: Record<string, string>): string => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  };
}

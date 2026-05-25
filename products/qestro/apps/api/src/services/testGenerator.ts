export interface TestStep {
  action: 'click' | 'type' | 'wait' | 'navigate' | 'assert' | 'screenshot';
  selector?: string;
  text?: string;
  value?: string;
  duration?: number;
  url?: string;
  expected?: string;
}

export interface GeneratedTest {
  steps: TestStep[];
  estimatedDuration: number;
}

const SYSTEM_PROMPT = `You are a QA test automation expert. Convert user descriptions into detailed test steps.
Each step must be precise and executable. Return ONLY valid JSON.`;

const USER_PROMPT_TEMPLATE = `Convert this test description into numbered test steps:
"{description}"

Return JSON with format: { "steps": [{ "action": "click|type|wait|navigate|assert|screenshot", "selector?": "...", "text?": "...", "value?": "...", "duration?": 1000, "url?": "...", "expected?": "..." }], "estimatedDuration": 30000 }`;

export const testGenerator = {
  async generate(description: string, apiKey: string): Promise<GeneratedTest> {
    try {
      const prompt = USER_PROMPT_TEMPLATE.replace('{description}', description.replace(/"/g, '\\"'));

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        steps: parsed.steps || [],
        estimatedDuration: parsed.estimatedDuration || 30000,
      };
    } catch (error) {
      console.error('Test generation error:', error);
      return {
        steps: [{ action: 'navigate', url: '/' }],
        estimatedDuration: 5000,
      };
    }
  },

  validateSteps(steps: TestStep[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const validActions = ['click', 'type', 'wait', 'navigate', 'assert', 'screenshot'];

    if (!Array.isArray(steps)) {
      errors.push('Steps must be an array');
      return { valid: false, errors };
    }

    steps.forEach((step, i) => {
      if (!validActions.includes(step.action)) {
        errors.push(`Step ${i}: Invalid action "${step.action}"`);
      }
      if (
        (step.action === 'click' || step.action === 'type') &&
        !step.selector
      ) {
        errors.push(`Step ${i}: Missing selector for ${step.action}`);
      }
    });

    return { valid: errors.length === 0, errors };
  },
};

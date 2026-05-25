import { type Env } from '../worker';
import { getPersona } from '../data/personas';

export interface SwarmResult {
    topic: string;
    iterations: number;
    finalOutput: string;
    history: { role: 'generator' | 'critic'; content: string }[];
    status: 'consensus_reached' | 'max_iterations_reached' | 'failed';
}

export async function executeSwarm(
    topic: string,
    generatorId: string,
    criticId: string,
    maxIterations: number,
    env: Env,
    options?: { provider?: string; model?: string }
): Promise<SwarmResult> {
    const generator = getPersona(generatorId);
    const critic = getPersona(criticId);

    if (!generator || !critic) {
        throw new Error('Invalid agent personas provided for swarm');
    }

    const provider = options?.provider || 'deepseek';
    const model = options?.model || 'deepseek-chat';

    // Determine the API key based on the provider
    let apiKey: string | undefined;
    if (provider === 'anthropic') apiKey = env.ANTHROPIC_API_KEY;
    else if (provider === 'openai') apiKey = env.OPENAI_API_KEY;
    else apiKey = env.DEEPSEEK_API_KEY;

    if (!apiKey) {
        throw new Error(`API Key not found for provider: ${provider}`);
    }

    const history: { role: 'generator' | 'critic'; content: string }[] = [];
    let currentDraft = '';
    let iterations = 0;
    let status: SwarmResult['status'] = 'max_iterations_reached';

    // The Critic logic requires it to output JSON with a score
    const criticSystemPrompt = `
${critic.systemPrompt}
You are operating in an iterative debate/review swarm.
Your job is to review the draft against the original topic.
You MUST reply in a strict JSON format with exactly 2 keys:
{
    "score": <number 0-10>,
    "feedback": "<detailed string explaining what needs to change, or praise if perfect>"
}
If the draft fully satisfies the prompt with very high quality, give a score of 8 or higher.
    `;

    while (iterations < maxIterations) {
        iterations++;

        // --- 1. Generator Turn ---
        const generatorPrompt = iterations === 1
            ? `Please create an initial draft for the following topic: ${topic}`
            : `Please revise your previous draft based on the critic's feedback.
Original Topic: ${topic}

Critic's Feedback: ${history[history.length - 1].content}

Previous Draft: ${currentDraft}

Provide only the updated draft text in your response.`;

        try {
            currentDraft = await callLLMSync(provider, model, apiKey, generator.systemPrompt, generatorPrompt);
            history.push({ role: 'generator', content: currentDraft });

            // --- 2. Critic Turn ---
            const reviewPrompt = `Original Topic: ${topic}\nCurrent Draft:\n${currentDraft}`;
            const criticOutput = await callLLMSync(provider, model, apiKey, criticSystemPrompt, reviewPrompt);

            // Clean markdown blocks if LLM gave them
            const cleanedOutput = criticOutput.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedCritic = JSON.parse(cleanedOutput);

            history.push({
                role: 'critic',
                content: `Score: ${parsedCritic.score}/10. Feedback: ${parsedCritic.feedback}`
            });

            if (parsedCritic.score >= 8) {
                status = 'consensus_reached';
                break;
            }

        } catch (err: any) {
            console.error('[SwarmOrchestrator] Execution failed inside swarm loop:', err);
            status = 'failed';
            break;
        }
    }

    return {
        topic,
        iterations,
        finalOutput: currentDraft,
        history,
        status,
    };
}

async function callLLMSync(
    provider: string,
    model: string,
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
): Promise<string> {
    // Shared simple non-streaming sync call for the debate loop
    let response: Response;

    if (provider === 'anthropic') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: model || 'claude-3-5-sonnet-20240620',
                max_tokens: 4096,
                temperature: 0.3,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        if (!response.ok) throw new Error(`Anthropic error: ${await response.text()}`);
        const data = await response.json() as any;
        return data.content?.[0]?.text || '';
    }

    // Default to OpenAI compatible
    const baseUrl = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model || 'deepseek-chat',
            max_tokens: 4096,
            temperature: 0.3,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
            ],
            response_format: provider === 'openai' ? { type: 'json_object' } : undefined // deepseek doesn't perfectly support this flag natively yet, manual prompt is safer
        }),
    });

    if (!response.ok) throw new Error(`${provider} error: ${await response.text()}`);
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
}

import { ClawPipe } from 'clawpipe-ai';

const pipe = new ClawPipe({
  apiKey: process.env.CLAWPIPE_API_KEY!,
  projectId: 'nextjs-chatbot',
  enableBooster: true,
  enablePacker: true,
  enableCache: true,
  budgetCapUsd: 10,
});

export async function POST(req: Request) {
  const { message, history } = await req.json();

  const context = history
    ?.map((m: { role: string; text: string }) => `${m.role}: ${m.text}`)
    .join('\n');

  const fullPrompt = context
    ? `${context}\nuser: ${message}`
    : message;

  const result = await pipe.prompt(fullPrompt, {
    system: 'You are a helpful assistant. Be concise and clear.',
    maxTokens: 1024,
  });

  return Response.json({
    reply: result.text,
    meta: {
      latencyMs: result.meta.latencyMs,
      cached: result.meta.cached,
      boosted: result.meta.boosted,
      model: result.meta.model,
      estimatedCostUsd: result.meta.estimatedCostUsd,
      contextSavings: result.meta.contextSavings,
    },
  });
}

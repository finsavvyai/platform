import { NextResponse } from 'next/server';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const token = await getApiToken();
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { messages } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    const data = await apiClient<{ data: { reply: string } }>(
      '/api/ai/chat',
      {
        token,
        method: 'POST',
        body: JSON.stringify({ messages }),
      },
    );

    return NextResponse.json({ reply: data.data.reply });
  } catch (err) {
    // Pass through rate limit / quota errors from the API
    if (err instanceof Error && (err.message.includes('429') || err.message.includes('limit') || err.message.includes('Too many'))) {
      return NextResponse.json(
        { reply: 'You\'ve reached your daily AI message limit. Upgrade your plan for more messages, or try again tomorrow.' },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { reply: 'Sorry, I encountered an error. Please try again.' },
      { status: 200 },
    );
  }
}

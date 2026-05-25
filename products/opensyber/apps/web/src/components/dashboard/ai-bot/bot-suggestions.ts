export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

const SUGGESTION_MAP: Record<string, string[]> = {
  '/dashboard': ['What should I do first?', 'Show my security score', 'How do I deploy an agent?'],
  '/dashboard/security': ['Explain my security score', 'Top vulnerabilities', 'Generate compliance report'],
  '/dashboard/agents': ['Set up agent policy', 'View recent violations', 'Configure alert channels'],
  '/dashboard/cloud': ['Connect AWS account', 'Run CSPM scan', 'View findings'],
  '/dashboard/ai-spm': ['Which AI models are risky?', 'Audit model permissions', 'Check data exposure'],
  '/dashboard/marketplace': ['Find security skills', 'Publish a skill', 'Top rated skills'],
};

const DEFAULT_SUGGESTIONS = ['Help me get started', 'What can you do?', 'Show security overview'];

export function getSuggestions(pathname: string): string[] {
  for (const [prefix, suggestions] of Object.entries(SUGGESTION_MAP)) {
    if (prefix !== '/dashboard' && pathname.startsWith(prefix)) return suggestions;
  }
  if (pathname.startsWith('/dashboard')) {
    return SUGGESTION_MAP['/dashboard'];
  }
  return DEFAULT_SUGGESTIONS;
}

export const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'bot',
  content:
    "Hi! I'm your OpenSyber AI assistant. I can help you navigate the platform, " +
    'explain security findings, and suggest next steps. What would you like to know?',
  timestamp: new Date().toISOString(),
};

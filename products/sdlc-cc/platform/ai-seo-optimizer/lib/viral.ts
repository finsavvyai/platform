const roastTemplates = {
  high: [
    (s: number) => `My website just scored ${s}/100 on AI visibility. Your content could never. Check yours at`,
    (s: number) => `Plot twist: AI agents actually LIKE my content. ${s}/100 AI visibility score. Yours is probably a 12. Find out at`,
    (s: number) => `POV: you optimized for AI agents before it was cool. ${s}/100 on RankAI. You're welcome, future me. Get roasted at`,
    (s: number) => `ChatGPT cites MY blog. What's YOUR content doing? Sitting in page 47? ${s}/100 AI score. Check yours at`,
    (s: number) => `${s}/100 AI visibility. My content is so good even robots love it. Meanwhile your site is giving 404 energy. Test at`,
    (s: number) => `Just found out AI agents cite my site ${s}% of the time. I'm basically the Wikipedia of my niche now. Get scored at`,
  ],
  medium: [
    (s: number) => `Okay so my site got a ${s}/100 AI visibility score. Not terrible, not great. Like my cooking. See how you compare at`,
    (s: number) => `${s}/100 on AI visibility. ChatGPT knows I exist but we're not on speaking terms yet. Check your score at`,
    (s: number) => `My AI visibility score is ${s}/100. In human terms, that's like being invited to the party but sitting in the corner. Test yours at`,
    (s: number) => `Got a ${s}/100 from RankAI. AI agents see me but don't cite me. It's giving unrequited love. How's your content doing? Check at`,
    (s: number) => `${s}/100 AI score. Not the flex I wanted but at least I know now. Do you dare to find out yours? Go to`,
    (s: number) => `My website's AI visibility is ${s}/100. That's a solid C+. My parents would be proud. Actually they wouldn't. Check yours at`,
  ],
  low: [
    (s: number) => `My site scored ${s}/100 on AI visibility. ChatGPT literally doesn't know I exist. Therapy starts Monday. Get destroyed at`,
    (s: number) => `Just got ROASTED. ${s}/100 AI visibility score. AI agents actively avoid my content. Join the support group at`,
    (s: number) => `${s}/100. My AI visibility is lower than my self-esteem and that's saying something. Face your truth at`,
    (s: number) => `They said SEO was dead. My ${s}/100 AI score proves I'm dead too. At least to robots. Get your wake-up call at`,
    (s: number) => `BREAKING: AI agents have collectively agreed to pretend my website doesn't exist. ${s}/100. Join the club at`,
    (s: number) => `My AI visibility score is ${s}/100. I asked ChatGPT about my own site and it said "who?" Pain. Check yours at`,
  ],
};

const regenerateQuips = [
  'Not spicy enough? Let AI cook again.',
  'Want something meaner? Hit regenerate.',
  'Too mild? AI has more roasts in the oven.',
  'Not viral enough? Roll the dice again.',
  'Need more chaos? Regenerate for fresh heat.',
];

export function generateViralMessage(score: number): string {
  const tier = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
  const templates = roastTemplates[tier];
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template(score);
}

export function getRegenerateQuip(): string {
  return regenerateQuips[Math.floor(Math.random() * regenerateQuips.length)];
}

export function getScoreEmoji(score: number): string {
  if (score >= 90) return '🔥';
  if (score >= 75) return '💪';
  if (score >= 60) return '😅';
  if (score >= 45) return '😬';
  if (score >= 30) return '💀';
  return '🪦';
}

export function getScoreVerdict(score: number): string {
  if (score >= 90) return 'AI agents LOVE you';
  if (score >= 75) return 'You\'re on their radar';
  if (score >= 60) return 'They know you exist... barely';
  if (score >= 45) return 'AI agents ghosted you';
  if (score >= 30) return 'Invisible to robots';
  return 'Digitally deceased';
}

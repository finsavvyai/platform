const curbEpisodeTitles: Record<string, ((s: number) => string)[]> = {
  high: [
    (s) => `The ${s} Percenter`,
    (s) => `Larry Gets Cited`,
    (s) => `The AI Whisperer`,
    (s) => `Pretty, Pretty, Pretty Good Score`,
    (s) => `The Accidental Genius`,
    (s) => `Beloved by Robots`,
  ],
  medium: [
    (s) => `The ${s} Problem`,
    (s) => `Larry Gets Ignored`,
    (s) => `The Mediocre Content`,
    (s) => `Not Great, Not Terrible`,
    (s) => `The Middle Child`,
    (s) => `Almost Cited`,
  ],
  low: [
    (s) => `The ${s} Disaster`,
    (s) => `Larry Breaks the Internet (Nobody Notices)`,
    (s) => `The Invisible Website`,
    (s) => `Digitally Shunned`,
    (s) => `The Content Nobody Asked For`,
    (s) => `Robot Restraining Order`,
  ],
};

const curbMonologues: Record<string, ((s: number) => string)[]> = {
  high: [
    (s) => `You know what? ${s} out of 100. I'll take it. You wanna know why? Because ChatGPT — ChatGPT! — is citing MY website. You know how long I waited for this? Do you? It's like getting a reservation at that restaurant where they always say they're full. But for ME, they had a table.`,
    (s) => `${s}/100. My website. Larry David. Cited by artificial intelligence. You know what this means? It means I don't need friends anymore. I've got robots. And robots don't borrow things and not return them.`,
    (s) => `So I got a ${s}. Pretty, pretty, pretty good. You know who DIDN'T get a ${s}? Jeff. Jeff got a 34. And you wanna know what Jeff said? "Scores don't matter." SCORES DON'T MATTER. That's what people with 34s say.`,
    (s) => `I checked my AI score. ${s}. You know what the best part is? My content is being read by machines that have no capacity for small talk, no opinions about what I'm wearing, and they never ask "what do you do?" This is the relationship I've been looking for my whole life.`,
  ],
  medium: [
    (s) => `${s} out of 100. You know what that is? That's the score of a man who ALMOST matters. It's like being on the guest list but they put you at the table near the kitchen. You can hear the plates. The PLATES, for God's sake.`,
    (s) => `I got a ${s}. ChatGPT knows I exist but doesn't cite me. It's like being at a party where someone introduces you and the other person goes "oh" and walks away. That's my entire digital existence. "Oh."`,
    (s) => `${s}/100. You know what that is in restaurant terms? It's when the waiter says "good choice" but you can tell he doesn't mean it. That little pause before "good." I caught the pause. AI agents are giving me the pause.`,
    (s) => `So my AI visibility is ${s}. My wife said "that's not bad." NOT BAD. When someone says "not bad" about your AI score, that IS bad. "Not bad" is what you say about someone's new haircut when it's terrible.`,
  ],
  low: [
    (s) => `${s}. Out of 100. I asked Perplexity about my own website and it told me about a COMPLETELY DIFFERENT person with a similar name. A podiatrist in Omaha. I'm being confused with a podiatrist. In OMAHA.`,
    (s) => `My AI visibility score is ${s}. You know what has better AI visibility than me? A recipe blog from 2008 that hasn't been updated since the Obama administration. A RECIPE BLOG. With clip art.`,
    (s) => `${s} out of 100. I showed this to my friend Richard and he laughed. He LAUGHED. Then he checked his own score and got a 23. And you know what? He stopped laughing. Nobody's laughing now, Richard.`,
    (s) => `I got a ${s}. ChatGPT doesn't know I exist. Claude doesn't know I exist. Gemini doesn't know I exist. You know who DOES know I exist? My dentist. Because I owe him money. That's my entire digital footprint — dental debt.`,
  ],
};

export function getCurbEpisodeTitle(score: number): string {
  const tier = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
  const titles = curbEpisodeTitles[tier];
  return titles[Math.floor(Math.random() * titles.length)](score);
}

export function getCurbMonologue(score: number): string {
  const tier = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
  const monologues = curbMonologues[tier];
  return monologues[Math.floor(Math.random() * monologues.length)](score);
}

export function getCurbShareText(score: number, episodeTitle: string): string {
  if (score >= 75) {
    return `*curb your enthusiasm theme plays*\n\nS12E${score} "${episodeTitle}"\n\nI scored ${score}/100 on AI visibility. Pretty, pretty, pretty good.\n\nCheck if AI agents know YOU exist:`;
  }
  if (score >= 45) {
    return `*curb your enthusiasm theme plays*\n\nS12E${score} "${episodeTitle}"\n\nGot a ${score}/100 AI visibility score. I'm the human equivalent of a 404 page.\n\nDo you dare to check yours?`;
  }
  return `*curb your enthusiasm theme plays*\n\nS12E${score} "${episodeTitle}"\n\n${score}/100. AI agents have collectively filed a restraining order against my website.\n\nJoin me in digital irrelevance:`;
}

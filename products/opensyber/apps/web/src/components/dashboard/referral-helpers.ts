export interface ReferralData {
  referralCode: string;
  referredCount: number;
  creditsEarned: number;
}

export const REFERRAL_MILESTONES = [
  { count: 1, reward: '1 free month' },
  { count: 3, reward: '3 free months' },
  { count: 5, reward: '5 free months' },
  { count: 10, reward: '10 free months' },
] as const;

export function buildReferralLink(referralCode: string): string {
  return `https://opensyber.cloud/sign-up?ref=${referralCode}`;
}

export function buildInviteMessage(referralLink: string): string {
  return [
    'I use OpenSyber to monitor AI agent security, policy drift, and risky activity across my workflows.',
    'If you are deploying agents in production, this is worth trying.',
    '',
    `Use my invite link: ${referralLink}`,
  ].join('\n');
}

export function buildSocialShareText(referralLink: string): string {
  return `I use OpenSyber to monitor AI agent security in production. If you are deploying agents, this is worth a look: ${referralLink}`;
}

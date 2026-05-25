export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  lemonSqueezyCustomerId: string | null;
  lemonSqueezySubscriptionId: string | null;
  onboardingCompletedAt: string | null;
  onboardingProgress: string | null;
  trialStartedAt: string | null;
  emailFlags: string | null;
  referralCode: string | null;
  referredBy: string | null;
  referralCredits: number;
  createdAt: string;
  updatedAt: string;
}

export type Plan = 'free' | 'personal' | 'pro' | 'team' | 'professional' | 'enterprise' | 'mission_defender';

export interface CreateUserInput {
  id: string;
  email: string;
  name?: string;
  plan?: Plan;
}

export interface UpdateUserInput {
  name?: string;
  plan?: Plan;
  lemonSqueezyCustomerId?: string;
  lemonSqueezySubscriptionId?: string;
}

export interface OnboardingProgress {
  deployAgent: boolean;
  installSkill: boolean;
  reviewSecurity: boolean;
  setupAlertRule: boolean;
  inviteTeamMember: boolean;
}

export interface EmailFlags {
  welcomeSent?: boolean;
  agentDeployedSent?: boolean;
  firstSecurityEventSent?: boolean;
  trialEndingSent?: boolean;
  trialExpiredSent?: boolean;
}

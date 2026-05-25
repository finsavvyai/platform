import type { LucideIcon } from 'lucide-react';
import {
  Cloud, Code, Bot, GitBranch, MessageSquare, KeyRound,
  Activity, Briefcase,
} from 'lucide-react';

export type IntegrationCategory =
  | 'cloud' | 'ide' | 'ai-agent' | 'devops'
  | 'communication' | 'identity' | 'monitoring' | 'productivity';

export interface Integration {
  slug: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  color: string;
  tier: 'free' | 'pro' | 'team';
  features: string[];
  configFields: ConfigField[];
  setupSteps: string[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export const CATEGORY_META: Record<
  IntegrationCategory,
  { label: string; icon: LucideIcon; color: string }
> = {
  cloud: { label: 'Cloud Providers', icon: Cloud, color: 'text-orange-400' },
  ide: { label: 'IDEs & Editors', icon: Code, color: 'text-info' },
  'ai-agent': { label: 'AI Agents & Copilots', icon: Bot, color: 'text-purple-400' },
  devops: { label: 'DevOps & CI/CD', icon: GitBranch, color: 'text-green-400' },
  communication: { label: 'Communication', icon: MessageSquare, color: 'text-pink-400' },
  identity: { label: 'Identity & Access', icon: KeyRound, color: 'text-cyan-400' },
  monitoring: { label: 'Monitoring', icon: Activity, color: 'text-yellow-400' },
  productivity: { label: 'Productivity & SaaS', icon: Briefcase, color: 'text-info' },
};

export const SKILL_CATEGORIES = [
  { value: 'productivity', label: 'Productivity' },
  { value: 'developer', label: 'Developer Tools' },
  { value: 'finance', label: 'Finance' },
  { value: 'communication', label: 'Communication' },
  { value: 'home', label: 'Home Automation' },
  { value: 'security', label: 'Security' },
  { value: 'utilities', label: 'Utilities' },
] as const;

export interface SkillFormData {
  slug: string;
  name: string;
  description: string;
  category: string;
  githubUrl: string;
  version: string;
}

export const INITIAL_FORM: SkillFormData = {
  slug: '',
  name: '',
  description: '',
  category: 'utilities',
  githubUrl: '',
  version: '1.0.0',
};

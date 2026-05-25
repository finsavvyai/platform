/**
 * Onboarding Perception — Checklist Generator
 * Generates role-specific onboarding checklists with day 1, week 1, and month 1 items
 */

import type { ChecklistItem, OnboardingChecklist } from './onboarding-perception-types';

/**
 * Generate comprehensive onboarding checklist
 */
export function generateOnboardingChecklist(role: string, department: string): OnboardingChecklist {
	const day1 = buildDay1Items();
	const week1 = buildWeek1Items();
	const month1 = buildMonth1Items();

	appendRoleSpecificItems(role, day1, week1);

	return { day1, week1, month1 };
}

function buildDay1Items(): ChecklistItem[] {
	return [
		{
			id: 'setup-account',
			title: 'Set up your Microsoft 365 account',
			description: 'Log in with your credentials and complete MFA setup',
			category: 'setup',
			priority: 'high',
			estimatedTime: '15 minutes',
			completed: false,
			resources: [
				{
					title: 'MFA Setup Guide',
					url: 'https://docs.microsoft.com/mfa',
					type: 'document',
				},
			],
		},
		{
			id: 'install-apps',
			title: 'Install required applications',
			description: 'Download and configure essential tools for your role',
			category: 'setup',
			priority: 'high',
			estimatedTime: '30 minutes',
			completed: false,
		},
		{
			id: 'meet-team',
			title: 'Meet your team',
			description: 'Attend team introduction meeting',
			category: 'meeting',
			priority: 'high',
			estimatedTime: '1 hour',
			completed: false,
		},
		{
			id: 'review-handbook',
			title: 'Review employee handbook',
			description: 'Read company policies, values, and guidelines',
			category: 'reading',
			priority: 'medium',
			estimatedTime: '2 hours',
			completed: false,
		},
		{
			id: 'manager-1on1',
			title: 'First 1:1 with manager',
			description: 'Discuss expectations, goals, and first projects',
			category: 'meeting',
			priority: 'high',
			estimatedTime: '30 minutes',
			completed: false,
		},
	];
}

function buildWeek1Items(): ChecklistItem[] {
	return [
		{
			id: 'security-training',
			title: 'Complete security awareness training',
			description: 'Learn about phishing, data protection, and security best practices',
			category: 'training',
			priority: 'high',
			estimatedTime: '1 hour',
			completed: false,
		},
		{
			id: 'compliance-training',
			title: 'Complete compliance training',
			description: 'Understand regulatory requirements and company policies',
			category: 'training',
			priority: 'high',
			estimatedTime: '45 minutes',
			completed: false,
		},
		{
			id: 'explore-tools',
			title: 'Explore collaboration tools',
			description: 'Get familiar with Teams, SharePoint, and other platforms',
			category: 'task',
			priority: 'medium',
			estimatedTime: '2 hours',
			completed: false,
		},
		{
			id: 'shadow-colleague',
			title: 'Shadow a colleague',
			description: 'Observe how experienced team members work',
			category: 'task',
			priority: 'medium',
			estimatedTime: '4 hours',
			completed: false,
		},
	];
}

function buildMonth1Items(): ChecklistItem[] {
	return [
		{
			id: 'first-project',
			title: 'Complete first project',
			description: 'Deliver your first meaningful contribution',
			category: 'task',
			priority: 'high',
			estimatedTime: '2 weeks',
			completed: false,
		},
		{
			id: 'feedback-session',
			title: '30-day feedback session',
			description: 'Review progress and adjust goals with manager',
			category: 'meeting',
			priority: 'high',
			estimatedTime: '1 hour',
			completed: false,
		},
		{
			id: 'network-building',
			title: 'Build your network',
			description: 'Connect with colleagues across departments',
			category: 'task',
			priority: 'medium',
			estimatedTime: 'Ongoing',
			completed: false,
		},
	];
}

function appendRoleSpecificItems(role: string, day1: ChecklistItem[], week1: ChecklistItem[]): void {
	const roleLower = role.toLowerCase();
	if (roleLower.includes('developer') || roleLower.includes('engineer')) {
		day1.push({
			id: 'dev-setup', title: 'Set up development environment',
			description: 'Configure IDE, clone repositories, set up local environment',
			category: 'setup', priority: 'high', estimatedTime: '2 hours', completed: false,
		});
		week1.push({
			id: 'code-review', title: 'Participate in code review',
			description: 'Review and provide feedback on team code',
			category: 'task', priority: 'medium', estimatedTime: '1 hour', completed: false,
		});
	}
	if (roleLower.includes('sales')) {
		day1.push({
			id: 'crm-setup', title: 'Set up CRM access',
			description: 'Configure Salesforce and learn basic navigation',
			category: 'setup', priority: 'high', estimatedTime: '1 hour', completed: false,
		});
		week1.push({
			id: 'sales-training', title: 'Product knowledge training',
			description: 'Learn about products, pricing, and sales process',
			category: 'training', priority: 'high', estimatedTime: '4 hours', completed: false,
		});
	}
	if (roleLower.includes('marketing')) {
		day1.push({
			id: 'marketing-tools', title: 'Access marketing tools',
			description: 'Set up access to Canva, HubSpot, and analytics platforms',
			category: 'setup', priority: 'high', estimatedTime: '1 hour', completed: false,
		});
	}
}

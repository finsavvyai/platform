/**
 * Onboarding Perception — Welcome Email Generator
 * Generates personalized HTML welcome emails for new employees
 */

import type { WelcomeEmail } from './onboarding-perception-types';

/**
 * Generate personalized welcome email
 */
export function generateWelcomeEmail(
	employeeName: string,
	employeeEmail: string,
	role: string,
	department: string,
	startDate: string,
	manager?: string
): WelcomeEmail {
	const firstName = employeeName.split(' ')[0];
	const formattedStartDate = new Date(startDate).toLocaleDateString('en-US', {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});

	const body = buildEmailHtml(firstName, role, department, employeeEmail, formattedStartDate, manager);

	return {
		to: employeeEmail,
		subject: `Welcome to the team, ${firstName}! Your ${role} journey starts ${formattedStartDate}`,
		body,
		attachments: [
			{
				name: 'Employee Handbook',
				content: 'https://company.com/handbook',
				type: 'link',
			},
			{
				name: 'IT Setup Guide',
				content: 'https://company.com/it-setup',
				type: 'link',
			},
		],
	};
}

function buildEmailHtml(
	firstName: string,
	role: string,
	department: string,
	employeeEmail: string,
	formattedStartDate: string,
	manager?: string
): string {
	return `
<!DOCTYPE html>
<html>
<head>
	<style>
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
		.container { max-width: 600px; margin: 0 auto; padding: 20px; }
		.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
		.content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
		.section { margin: 20px 0; }
		.checklist { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
		.checklist-item { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
		.checklist-item:last-child { border-bottom: none; }
		.badge { display: inline-block; padding: 4px 12px; background: #667eea; color: white; border-radius: 12px; font-size: 12px; }
		.footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
		.cta-button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>🎉 Welcome to the Team, ${firstName}!</h1>
			<p>We're excited to have you join us as ${role}</p>
		</div>

		<div class="content">
			<div class="section">
				<h2>👋 Getting Started</h2>
				<p>Your first day is <strong>${formattedStartDate}</strong>. We've prepared everything you need to hit the ground running!</p>
				${manager ? `<p>Your manager, <strong>${manager}</strong>, will be your primary point of contact.</p>` : ''}
			</div>

			<div class="section">
				<h2>✅ Your Day 1 Checklist</h2>
				<div class="checklist">
					<div class="checklist-item">
						<strong>🔐 Set up your account</strong><br>
						<small>Check your email for login credentials and set up MFA</small>
						<span class="badge">15 min</span>
					</div>
					<div class="checklist-item">
						<strong>💻 Configure your workspace</strong><br>
						<small>Install required applications and tools</small>
						<span class="badge">30 min</span>
					</div>
					<div class="checklist-item">
						<strong>👥 Meet your team</strong><br>
						<small>Introductory meeting with ${department} team</small>
						<span class="badge">1 hour</span>
					</div>
					<div class="checklist-item">
						<strong>📚 Review onboarding materials</strong><br>
						<small>Company handbook, policies, and ${department} resources</small>
						<span class="badge">2 hours</span>
					</div>
					<div class="checklist-item">
						<strong>🎯 Set up 1:1 with manager</strong><br>
						<small>Discuss goals, expectations, and first projects</small>
						<span class="badge">30 min</span>
					</div>
				</div>
			</div>

			<div class="section">
				<h2>🛠️ Your Tools & Access</h2>
				<p>We've provisioned the following for you:</p>
				<ul>
					<li><strong>Email:</strong> ${employeeEmail}</li>
					<li><strong>Microsoft 365:</strong> Full suite access</li>
					<li><strong>Teams:</strong> Join ${department} channels</li>
					<li><strong>Security:</strong> MFA enabled for your protection</li>
				</ul>
			</div>

			<div class="section">
				<h2>📅 Your First Week</h2>
				<ul>
					<li><strong>Day 1:</strong> Orientation, setup, team introductions</li>
					<li><strong>Day 2-3:</strong> Role-specific training and shadowing</li>
					<li><strong>Day 4:</strong> Security and compliance training</li>
					<li><strong>Day 5:</strong> First project assignment and goal setting</li>
				</ul>
			</div>

			<div class="section">
				<h2>🤝 Need Help?</h2>
				<p>We're here to support you:</p>
				<ul>
					<li><strong>IT Support:</strong> it-support@company.com</li>
					<li><strong>HR Questions:</strong> hr@company.com</li>
					${manager ? `<li><strong>Your Manager:</strong> ${manager}</li>` : ''}
				</ul>
			</div>

			<div class="section" style="text-align: center;">
				<a href="#" class="cta-button">Access Your Onboarding Portal</a>
			</div>

			<div class="footer">
				<p>Looking forward to working with you! 🚀</p>
				<p><small>This is an automated message from TenantIQ Onboarding System</small></p>
			</div>
		</div>
	</div>
</body>
</html>
`.trim();
}

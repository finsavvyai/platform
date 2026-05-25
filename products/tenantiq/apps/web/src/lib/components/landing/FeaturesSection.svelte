<script lang="ts">
	const pillars = [
		{
			icon: '🪞',
			title: 'The Uncomfortable Audit',
			desc: '"TenantIQ doesn\'t just monitor your Microsoft 365… it watches it like a suspicious neighbor who already called the police."',
			reality: 'Your tenants have problems. We find them. All of them. Even the ones you were hoping nobody would notice.',
			items: ['100+ CIS Benchmark Controls', 'Secure Score Tracking', 'Real-Time Threat Detection', 'Auto-Remediation Engine'],
			liner: '"We scan your tenant so thoroughly, even your bad decisions feel exposed."'
		},
		{
			icon: '📋',
			title: 'The Compliance Reality Check',
			desc: '"Passing an audit and being actually compliant are two different things. One is a checkbox. The other is reality."',
			reality: 'Map controls to SOC 2, HIPAA, GDPR, and Zero Trust. Generate evidence packages so audit prep takes hours, not weeks.',
			items: ['5 Compliance Frameworks', 'Evidence Auto-Collection', 'Continuous Monitoring', 'Executive PDF Reports'],
			liner: '"Your auditor called. They have questions. TenantIQ has answers."'
		},
		{
			icon: '💸',
			title: 'The License Waste Intervention',
			desc: '"You\'re paying for licenses nobody uses. That\'s not budgeting. That\'s a donation to Microsoft."',
			reality: 'AI-powered optimization detects unused seats, duplicate assignments, and wrong tiers. Then fixes them. Automatically.',
			items: ['AI License Optimizer', 'Cost Autopilot Mode', 'Savings Dashboard', 'Downgrade Recommendations'],
			liner: '"You didn\'t have a licensing strategy. You had a licensing situation."'
		}
	];
</script>

<section class="features" id="features">
	<div class="section-header">
		<span class="label">What We Actually Do</span>
		<h2>Three Things You've Been Ignoring</h2>
		<p>TenantIQ handles the stuff you keep meaning to get to "next quarter."</p>
	</div>
	<div class="pillars">
		{#each pillars as pillar}
			<div class="pillar-card">
				<div class="pillar-icon">{pillar.icon}</div>
				<h3>{pillar.title}</h3>
				<p class="pillar-quote">{pillar.desc}</p>
				<p class="pillar-desc">{pillar.reality}</p>
				<ul class="pillar-items">
					{#each pillar.items as item}
						<li><span class="check">&#10003;</span> {item}</li>
					{/each}
				</ul>
				<div class="pillar-liner">{pillar.liner}</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.features { padding: 6rem 5%; max-width: 1200px; margin: 0 auto; }
	.section-header { text-align: center; margin-bottom: 3.5rem; }
	.label { display: inline-block; padding: 0.35rem 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 999px; font-size: 0.8rem; color: #ef4444; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1rem; }
	.section-header h2 { font-size: 2.75rem; font-weight: 700; margin-bottom: 1rem; }
	.section-header p { font-size: 1.15rem; color: #94a3b8; }
	.pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
	.pillar-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(239,68,68,0.12); border-radius: 16px; padding: 2rem; transition: all 0.3s ease; display: flex; flex-direction: column; }
	.pillar-card:hover { background: rgba(239,68,68,0.04); transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
	.pillar-icon { font-size: 2.5rem; margin-bottom: 1rem; }
	.pillar-card h3 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.75rem; color: #ef4444; }
	.pillar-quote { color: #f59e0b; font-style: italic; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
	.pillar-desc { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem; }
	.pillar-items { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; flex: 1; }
	.pillar-items li { font-size: 0.9rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.5rem; }
	.check { color: #10b981; font-weight: 700; font-size: 0.85rem; }
	.pillar-liner { font-size: 0.8rem; color: #64748b; font-style: italic; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.04); }
	@media (max-width: 768px) { .pillars { grid-template-columns: 1fr; } .section-header h2 { font-size: 2rem; } }
</style>

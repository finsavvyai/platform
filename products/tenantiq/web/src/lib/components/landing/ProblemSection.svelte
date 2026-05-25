<script lang="ts">
	const truths = [
		{
			icon: '🪞',
			title: 'The Mirror You Didn\'t Ask For',
			desc: 'TenantIQ is basically a mirror—but for your worst configuration choices. And it doesn\'t lie.',
			stat: '87% fail first scan',
			liner: '"You didn\'t misconfigure anything? Wow. That\'s… statistically unlikely."'
		},
		{
			icon: '🔍',
			title: 'The Suspicious Neighbor',
			desc: 'TenantIQ watches your Microsoft 365 like a suspicious neighbor who already called the police. Nothing gets past it.',
			stat: '100+ checks per tenant',
			liner: '"Oh, you trust your configurations? TenantIQ doesn\'t trust you trusting them."'
		},
		{
			icon: '💀',
			title: 'The Uncomfortable Discovery',
			desc: 'TenantIQ finds problems you didn\'t know existed—and frankly, would\'ve preferred not knowing about.',
			stat: 'Avg 23 issues found',
			liner: '"We don\'t create problems. We just reveal the ones you\'ve been ignoring."'
		}
	];

	const painPoints = [
		{ before: '"It works"', after: '"It\'s secure"', verdict: 'Not the same thing. Deep down—you know that.' },
		{ before: '"We passed the audit"', after: '"We\'re actually compliant"', verdict: 'One is a checkbox. The other is reality.' },
		{ before: '"I checked last month"', after: '"I check continuously"', verdict: 'Threats don\'t wait for your quarterly review.' },
	];
</script>

<section class="problem" id="problem">
	<div class="section-header">
		<span class="label">The Uncomfortable Truth</span>
		<h2>We Didn't Build This Because Everything Was Fine</h2>
		<p>We built it because nothing was fine—and everyone was pretending otherwise.</p>
	</div>

	<div class="cards">
		{#each truths as t}
			<div class="card">
				<div class="card-icon">{t.icon}</div>
				<h3>{t.title}</h3>
				<p>{t.desc}</p>
				<div class="card-stat">{t.stat}</div>
				<div class="card-liner">{t.liner}</div>
			</div>
		{/each}
	</div>

	<div class="vs-section">
		<h3 class="vs-title">What You Say vs. What's True</h3>
		<div class="vs-grid">
			{#each painPoints as p}
				<div class="vs-card">
					<div class="vs-row">
						<span class="vs-label before">You say</span>
						<span class="vs-value before">{p.before}</span>
					</div>
					<div class="vs-divider">≠</div>
					<div class="vs-row">
						<span class="vs-label after">Reality</span>
						<span class="vs-value after">{p.after}</span>
					</div>
					<p class="vs-verdict">{p.verdict}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	.problem { padding: 6rem 5%; max-width: 1200px; margin: 0 auto; }
	.section-header { text-align: center; margin-bottom: 3.5rem; }
	.label { display: inline-block; padding: 0.35rem 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 999px; font-size: 0.8rem; color: #ef4444; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1rem; }
	.section-header h2 { font-size: 2.75rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.15; }
	.section-header p { font-size: 1.15rem; color: #94a3b8; }
	.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 4rem; }
	.card { background: rgba(255,255,255,0.02); border: 1px solid rgba(239,68,68,0.12); border-radius: 16px; padding: 2rem; transition: all 0.3s ease; }
	.card:hover { background: rgba(239,68,68,0.04); transform: translateY(-4px); }
	.card-icon { font-size: 2.5rem; margin-bottom: 1rem; }
	.card h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; }
	.card p { color: #94a3b8; line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.25rem; }
	.card-stat { display: inline-block; padding: 0.35rem 0.75rem; background: rgba(239,68,68,0.08); border-radius: 8px; font-size: 0.85rem; color: #ef4444; font-weight: 600; margin-bottom: 1rem; }
	.card-liner { font-size: 0.85rem; color: #f59e0b; font-style: italic; line-height: 1.5; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); }

	/* VS Section */
	.vs-section { text-align: center; }
	.vs-title { font-size: 1.5rem; font-weight: 700; margin-bottom: 2rem; color: #f1f5f9; }
	.vs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
	.vs-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.75rem; text-align: center; }
	.vs-row { display: flex; flex-direction: column; gap: 0.25rem; }
	.vs-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
	.vs-label.before { color: #64748b; }
	.vs-label.after { color: #10b981; }
	.vs-value { font-size: 1.1rem; font-weight: 600; }
	.vs-value.before { color: #94a3b8; }
	.vs-value.after { color: #10b981; }
	.vs-divider { font-size: 1.5rem; color: #ef4444; font-weight: 700; padding: 0.5rem 0; }
	.vs-verdict { font-size: 0.85rem; color: #f59e0b; font-style: italic; margin-top: 0.75rem; line-height: 1.4; }

	@media (max-width: 768px) { .cards, .vs-grid { grid-template-columns: 1fr; } .section-header h2 { font-size: 2rem; } }
</style>

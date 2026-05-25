<script lang="ts">
	const actions = [
		{ icon: '🔐', label: 'Enable MFA', subtext: 'Because "password123" is not a security strategy' },
		{ icon: '🚫', label: 'Revoke Sessions', subtext: 'Kick out whoever shouldn\'t be there' },
		{ icon: '⬇️', label: 'Downgrade Licenses', subtext: 'Stop overpaying. Microsoft has enough money' },
		{ icon: '🛑', label: 'Block Risky IPs', subtext: 'If they look suspicious, they probably are' }
	];

	const steps = [
		{ num: '1', title: 'TenantIQ Finds It', desc: 'Discovers the problem you didn\'t know you had.' },
		{ num: '2', title: 'You Preview The Fix', desc: 'See exactly what will change. No surprises.' },
		{ num: '3', title: 'One Click. Fixed.', desc: 'Execute with confidence. Rollback if you panic.' },
	];
</script>

<section class="remediation" id="security">
	<div class="section-header">
		<span class="label">The Fix Is In</span>
		<h2>From "Oh No" to "Oh Good" in One Click</h2>
		<p>"Every action includes dry-run preview and full rollback. Because we know you'll want to double-check. We would too."</p>
	</div>

	<div class="steps-row">
		{#each steps as step, i}
			<div class="step-card">
				<div class="step-num">{step.num}</div>
				<h4>{step.title}</h4>
				<p>{step.desc}</p>
			</div>
			{#if i < steps.length - 1}
				<div class="step-arrow">→</div>
			{/if}
		{/each}
	</div>

	<div class="action-grid">
		{#each actions as action}
			<div class="action-badge">
				<span class="action-icon">{action.icon}</span>
				<div class="action-text">
					<span class="action-label">{action.label}</span>
					<span class="action-sub">{action.subtext}</span>
				</div>
			</div>
		{/each}
	</div>

	<div class="safety">
		<span class="safety-icon">🛡️</span>
		<span>"From insight to action in one click. From action to rollback in one more. We thought of everything, including your anxiety."</span>
	</div>
</section>

<style>
	.remediation { padding: 6rem 5%; max-width: 1000px; margin: 0 auto; text-align: center; }
	.section-header { margin-bottom: 3rem; }
	.label { display: inline-block; padding: 0.35rem 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 999px; font-size: 0.8rem; color: #ef4444; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1rem; }
	.section-header h2 { font-size: 2.75rem; font-weight: 700; margin-bottom: 1rem; }
	.section-header p { font-size: 1.05rem; color: #f59e0b; font-style: italic; max-width: 640px; margin-inline: auto; line-height: 1.6; }

	/* Steps row */
	.steps-row { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap; }
	.step-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.5rem; width: 200px; text-align: center; }
	.step-num { width: 36px; height: 36px; border-radius: 50%; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; font-weight: 800; font-size: 1rem; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; }
	.step-card h4 { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
	.step-card p { font-size: 0.85rem; color: #94a3b8; line-height: 1.5; }
	.step-arrow { font-size: 1.5rem; color: #64748b; }

	.action-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; max-width: 700px; margin: 0 auto 2.5rem; }
	.action-badge { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(239,68,68,0.12); border-radius: 12px; text-align: left; transition: all 0.3s ease; }
	.action-badge:hover { background: rgba(239,68,68,0.05); transform: translateY(-2px); }
	.action-icon { font-size: 1.5rem; flex-shrink: 0; }
	.action-text { display: flex; flex-direction: column; }
	.action-label { font-size: 0.95rem; font-weight: 600; color: #e2e8f0; }
	.action-sub { font-size: 0.8rem; color: #64748b; font-style: italic; margin-top: 2px; }

	.safety { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; font-size: 0.85rem; color: #94a3b8; max-width: 640px; text-align: left; line-height: 1.5; }
	.safety-icon { font-size: 1.1rem; flex-shrink: 0; }
	@media (max-width: 768px) { .section-header h2 { font-size: 2rem; } .action-grid { grid-template-columns: 1fr; } .steps-row { flex-direction: column; } .step-arrow { transform: rotate(90deg); } }
</style>

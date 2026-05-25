<script lang="ts">
	let annual = $state(false);

	const plans = [
		{
			name: 'Starter',
			monthly: 49,
			annual: 39,
			unit: '/tenant/mo',
			desc: 'For MSPs who are ready to face the truth',
			tenants: 'Up to 9 tenants',
			liner: '"It\'s not expensive. It\'s cheaper than the breach."',
			features: [
				'121 CIS controls (L1+L2 tagged)',
				'Mailbox rule auditor (BEC detection)',
				'License utilization + reclamation',
				'Real-time WebSocket alerts',
				'Public prospect scan',
			],
			highlight: false,
			cta: 'Start Facing Reality',
			checkoutUrl: '#STARTER_CHECKOUT_URL',
		},
		{
			name: 'Professional',
			monthly: 99,
			annual: 79,
			unit: '/tenant/mo',
			desc: 'For MSPs who want the full uncomfortable picture',
			tenants: 'Up to 25 tenants',
			volumeNote: 'Volume pricing from $45/tenant',
			liner: '"This plan pays for itself in the first scan. The rest is just showing off."',
			features: [
				'Everything in Starter',
				'AI control explainer (Claude per-finding)',
				'Auto-remediation with rollback',
				'ISO 27001 + SOC2 + HIPAA + GDPR',
				'Drift revert (named baselines + attribution)',
				'License optimization',
				'Priority support',
			],
			highlight: true,
			cta: 'Show Me Everything',
			checkoutUrl: '#PROFESSIONAL_CHECKOUT_URL',
		},
		{
			name: 'Enterprise',
			monthly: null,
			annual: null,
			unit: '',
			desc: 'For MSPs at scale who can\'t afford surprises',
			tenants: 'Unlimited tenants',
			liner: '"At this level, the only surprise should be how much money you\'re saving."',
			features: [
				'Everything in Professional',
				'SSO / SAML',
				'White-label options',
				'Custom integrations',
				'SLA guarantee',
				'Dedicated CSM',
				'Data residency',
			],
			highlight: false,
			cta: 'Let\'s Talk',
			checkoutUrl: '/support',
		},
	];

	function price(plan: (typeof plans)[0]) {
		if (plan.monthly === null) return null;
		return annual ? plan.annual : plan.monthly;
	}

	function savings(plan: (typeof plans)[0]) {
		if (plan.monthly === null || plan.annual === null) return 0;
		return (plan.monthly - plan.annual) * 12;
	}
</script>

<section class="pricing" id="pricing">
	<div class="section-header">
		<span class="label">The Price of Knowing</span>
		<h2>Cheaper Than The Breach</h2>
		<p>14-day free trial. No credit card. No commitment. Just the uncomfortable truth about your tenants.</p>

		<div class="toggle-row">
			<button
				class="toggle-opt"
				class:active={!annual}
				onclick={() => (annual = false)}
			>Monthly</button>
			<button
				class="toggle-opt"
				class:active={annual}
				onclick={() => (annual = true)}
			>
				Annual
				<span class="save-badge">Save 20%</span>
			</button>
		</div>
	</div>

	<div class="plan-grid">
		{#each plans as plan}
			<div class="plan-card" class:recommended={plan.highlight}>
				{#if plan.highlight}<span class="rec-badge">Most Popular (Wisest Choice)</span>{/if}
				<h3>{plan.name}</h3>
				<div class="plan-price">
					{#if price(plan) !== null}
						<span class="dollar">$</span><span class="amount">{price(plan)}</span>
						<span class="period">{plan.unit}</span>
					{:else}
						<span class="amount custom">Custom</span>
					{/if}
				</div>
				{#if annual && savings(plan) > 0}
					<p class="annual-savings">Save ${savings(plan)}/tenant/year</p>
				{/if}
				<p class="plan-desc">{plan.desc}</p>
				<p class="tenant-cap">{plan.tenants}</p>
				{#if plan.volumeNote}
					<p class="volume-note">{plan.volumeNote}</p>
				{/if}
				<ul>
					{#each plan.features as f}
						<li><span class="check">&#10003;</span> {f}</li>
					{/each}
				</ul>
				<p class="plan-liner">{plan.liner}</p>
				<a
					href={plan.checkoutUrl}
					class="plan-cta lemonsqueezy-button"
					class:primary={plan.highlight}
				>
					{plan.cta}
				</a>
			</div>
		{/each}
	</div>

	<div class="volume-section">
		<h3>Volume Discounts <span class="vol-sub">(Because loyalty should be rewarded, not punished)</span></h3>
		<div class="volume-grid">
			<div class="vol-tier">
				<span class="vol-range">1–9 tenants</span>
				<span class="vol-price">${annual ? 79 : 99}/tenant/mo</span>
			</div>
			<div class="vol-tier">
				<span class="vol-range">10–24 tenants</span>
				<span class="vol-price">${annual ? 63 : 79}/tenant/mo</span>
			</div>
			<div class="vol-tier">
				<span class="vol-range">25–49 tenants</span>
				<span class="vol-price">${annual ? 47 : 59}/tenant/mo</span>
			</div>
			<div class="vol-tier">
				<span class="vol-range">50+ tenants</span>
				<span class="vol-price">${annual ? 36 : 45}/tenant/mo</span>
			</div>
		</div>
	</div>

	<div class="money-back">
		<p>"If TenantIQ doesn't find at least one thing wrong with your tenant in 14 days, we'll be genuinely shocked. But you can still cancel for free."</p>
	</div>
</section>

<style>
	.pricing { padding: 6rem 5%; max-width: 1200px; margin: 0 auto; }
	.section-header { text-align: center; margin-bottom: 3.5rem; }
	.label { display: inline-block; padding: 0.35rem 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 999px; font-size: 0.8rem; color: #ef4444; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1rem; }
	.section-header h2 { font-size: 2.75rem; font-weight: 700; margin-bottom: 1rem; }
	.section-header p { font-size: 1.05rem; color: #94a3b8; max-width: 540px; margin-inline: auto; }

	.toggle-row { display: inline-flex; gap: 0; margin-top: 1.5rem; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; }
	.toggle-opt { padding: 0.6rem 1.5rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; background: transparent; color: #94a3b8; border: none; transition: all 0.2s; display: flex; align-items: center; gap: 0.5rem; }
	.toggle-opt.active { background: rgba(239,68,68,0.12); color: #ef4444; }
	.save-badge { font-size: 0.65rem; padding: 0.15rem 0.5rem; background: #ef4444; color: #fff; border-radius: 999px; font-weight: 700; }

	.plan-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; align-items: start; }
	.plan-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 2rem; position: relative; transition: all 0.3s ease; }
	.plan-card.recommended { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.04); }
	.plan-card:hover { transform: translateY(-4px); }
	.rec-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 0.3rem 1rem; background: #ef4444; color: white; font-size: 0.7rem; font-weight: 700; border-radius: 999px; letter-spacing: 0.03em; white-space: nowrap; }
	.plan-card h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; }
	.plan-price { margin-bottom: 0.25rem; }
	.dollar { font-size: 1.25rem; color: #94a3b8; vertical-align: top; }
	.amount { font-size: 3rem; font-weight: 800; color: #ef4444; }
	.amount.custom { font-size: 2.5rem; }
	.period { font-size: 0.9rem; color: #64748b; }
	.annual-savings { font-size: 0.8rem; color: #10b981; font-weight: 600; margin-bottom: 0.25rem; }
	.plan-desc { font-size: 0.9rem; color: #94a3b8; margin-bottom: 0.5rem; }
	.tenant-cap { font-size: 0.85rem; color: #cbd5e1; font-weight: 600; margin-bottom: 0.5rem; }
	.volume-note { font-size: 0.75rem; color: #ef4444; font-weight: 500; margin-bottom: 0.75rem; }
	ul { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
	li { font-size: 0.9rem; color: #cbd5e1; display: flex; align-items: center; gap: 0.5rem; }
	.check { color: #10b981; font-weight: 700; }
	.plan-liner { font-size: 0.8rem; color: #f59e0b; font-style: italic; margin-bottom: 1.25rem; padding: 0.75rem; background: rgba(245,158,11,0.06); border-radius: 10px; line-height: 1.4; }
	.plan-cta { display: block; text-align: center; padding: 0.85rem; border-radius: 10px; font-weight: 600; font-size: 0.95rem; text-decoration: none; border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; background: rgba(255,255,255,0.03); transition: all 0.3s ease; }
	.plan-cta.primary { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; }
	.plan-cta:hover { transform: translateY(-2px); }

	.volume-section { margin-top: 3rem; text-align: center; }
	.volume-section h3 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; color: #e2e8f0; }
	.vol-sub { font-size: 0.85rem; color: #64748b; font-weight: 400; font-style: italic; }
	.volume-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; max-width: 800px; margin: 0 auto; }
	.vol-tier { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1rem; }
	.vol-range { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.25rem; }
	.vol-price { font-size: 1.1rem; font-weight: 700; color: #ef4444; }

	.money-back { text-align: center; margin-top: 2.5rem; padding: 1.25rem 2rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; max-width: 640px; margin-inline: auto; }
	.money-back p { font-size: 0.9rem; color: #f59e0b; font-style: italic; line-height: 1.6; }

	@media (max-width: 768px) {
		.plan-grid { grid-template-columns: 1fr; max-width: 400px; margin-inline: auto; }
		.section-header h2 { font-size: 2rem; }
		.volume-grid { grid-template-columns: repeat(2, 1fr); }
	}
</style>

<script lang="ts">
	const testimonials = [
		{
			quote: 'TenantIQ saved us $45,000 annually just from license optimization alone. The ROI was immediate.',
			author: 'Sarah Chen',
			role: 'CTO, TechCorp MSP'
		},
		{
			quote: 'The automated backup and restore features give us peace of mind. We recovered from a ransomware attack in minutes.',
			author: 'Michael Rodriguez',
			role: 'IT Director, FinanceHub'
		},
		{
			quote: "Best M365 management platform we've used. The AI insights are genuinely helpful, not just marketing hype.",
			author: 'Emily Watson',
			role: 'VP Engineering, DataFlow'
		}
	];
</script>

<section class="section">
	<div class="section-header">
		<span class="eyebrow">Customers</span>
		<h2>Trusted by MSPs<br /><span class="muted">who take security seriously.</span></h2>
	</div>
	<div class="grid">
		{#each testimonials as t}
			<div class="card">
				<svg class="quote-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 8H6a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2v-2h-2a2 2 0 01-2-2V8zm10 0h-4a2 2 0 00-2 2v4a2 2 0 002 2h2a2 2 0 002-2v-2h-2a2 2 0 01-2-2V8z" fill="rgba(16,185,129,0.15)"/></svg>
				<p class="quote">{t.quote}</p>
				<div class="author">
					<div class="avatar">{t.author[0]}</div>
					<div>
						<span class="name">{t.author}</span>
						<span class="role">{t.role}</span>
					</div>
				</div>
			</div>
		{/each}
	</div>
</section>

<style>
	.section { padding: 8rem 5%; max-width: 1100px; margin: 0 auto; }
	.section-header { text-align: center; margin-bottom: 4rem; }
	.eyebrow { display: inline-block; padding: 0.3rem 0.9rem; border: 1px solid rgba(16,185,129,0.15); border-radius: 999px; font-size: 0.7rem; color: #10b981; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 1.25rem; }
	h2 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; letter-spacing: -0.03em; color: #f1f5f9; line-height: 1.15; }
	.muted { color: #475569; }

	.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }

	.card {
		background: rgba(255,255,255,0.02);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 16px;
		padding: 2rem;
		position: relative;
		transition: border-color 0.3s;
	}
	.card:hover { border-color: rgba(255,255,255,0.12); }

	.quote-icon { position: absolute; top: 1.25rem; right: 1.25rem; }

	.quote {
		font-size: 0.95rem;
		line-height: 1.65;
		color: #cbd5e1;
		margin-bottom: 1.5rem;
	}

	.author { display: flex; align-items: center; gap: 0.75rem; }
	.avatar {
		width: 36px; height: 36px;
		border-radius: 50%;
		background: rgba(16,185,129,0.1);
		border: 1px solid rgba(16,185,129,0.2);
		display: flex; align-items: center; justify-content: center;
		font-size: 0.8rem; font-weight: 700; color: #10b981;
	}
	.name { display: block; font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }
	.role { display: block; font-size: 0.7rem; color: #64748b; margin-top: 0.1rem; }

	@media (max-width: 768px) {
		.section { padding: 5rem 5%; }
		.grid { grid-template-columns: 1fr; max-width: 480px; margin-inline: auto; }
	}
	@media (max-width: 480px) {
		.section { padding: 3.5rem 4%; }
		.card { padding: 1.5rem; }
	}
</style>

<script lang="ts">
	const comparisons = [
		{ them: 'Assess your tenant', us: 'Fix your tenant', label: 'Action' },
		{ them: 'Generate a report', us: 'Remediate 1-click', label: 'Remediation' },
		{ them: 'Manual GDAP setup', us: 'AI manages GDAP', label: 'GDAP' },
		{ them: 'Schedule a demo call', us: '40-second prospect scan', label: 'Sales' },
		{ them: 'View compliance gaps', us: 'Auto-close compliance gaps', label: 'Compliance' },
		{ them: 'Show license waste', us: 'Auto-downgrade licenses', label: 'Licenses' },
	];
</script>

<section class="demo" id="demo">
	<div class="section-header">
		<span class="label">Why TenantIQ</span>
		<h2>Assessment Tools vs. Action Engine</h2>
		<p>Other platforms tell you what's wrong. TenantIQ fixes it — automatically, with rollback.</p>
	</div>

	<div class="compare-table">
		<div class="compare-header">
			<span></span>
			<span class="col-them">Assessment Tools</span>
			<span class="col-us">TenantIQ AI Agent</span>
		</div>
		{#each comparisons as row}
			<div class="compare-row">
				<span class="row-label">{row.label}</span>
				<span class="row-them">{row.them}</span>
				<span class="row-us">{row.us}</span>
			</div>
		{/each}
	</div>

	<div class="prospect-cta">
		<div class="prospect-text">
			<h3>The 40-Second Sales Weapon</h3>
			<p>Scan any prospect's domain before the meeting. Walk in with a full security posture report. Close the deal.</p>
		</div>
		<a href="/prospect" class="prospect-btn">Try Prospect Scan Free →</a>
	</div>
</section>

<style>
	.demo { padding: 6rem 5%; max-width: 900px; margin: 0 auto; }
	.section-header { text-align: center; margin-bottom: 3rem; }
	.label { display: inline-block; padding: 0.35rem 1rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); border-radius: 999px; font-size: 0.8rem; color: #10b981; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1rem; }
	.section-header h2 { font-size: 2.75rem; font-weight: 700; margin-bottom: 1rem; }
	.section-header p { font-size: 1.15rem; color: #94a3b8; }

	/* Comparison table */
	.compare-table { border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden; margin-bottom: 3rem; }
	.compare-header, .compare-row { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 0; }
	.compare-header { background: rgba(255,255,255,0.03); padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
	.col-them { text-align: center; color: #94a3b8; }
	.col-us { text-align: center; color: #10b981; }
	.compare-row { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s; }
	.compare-row:last-child { border-bottom: none; }
	.compare-row:hover { background: rgba(16,185,129,0.03); }
	.row-label { font-size: 0.85rem; font-weight: 600; color: #94a3b8; display: flex; align-items: center; }
	.row-them { text-align: center; font-size: 0.9rem; color: #64748b; display: flex; align-items: center; justify-content: center; }
	.row-us { text-align: center; font-size: 0.9rem; color: #10b981; font-weight: 600; display: flex; align-items: center; justify-content: center; }

	/* Prospect CTA */
	.prospect-cta { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px; background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.12); border-radius: 20px; }
	.prospect-text h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 6px; }
	.prospect-text p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; }
	.prospect-btn { padding: 14px 28px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border-radius: 12px; font-size: 1rem; font-weight: 700; text-decoration: none; white-space: nowrap; transition: all 0.2s; flex-shrink: 0; }
	.prospect-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(239,68,68,0.3); }

	@media (max-width: 768px) {
		.section-header h2 { font-size: 2rem; }
		.compare-header, .compare-row { grid-template-columns: 80px 1fr 1fr; }
		.prospect-cta { flex-direction: column; text-align: center; }
	}
</style>

<script lang="ts">
	const queries = [
		{
			q: 'Who hasn\'t signed in for 90 days?',
			a: 'Found 23 inactive users across 4 tenants. 12 have active E5 licenses. That\'s $2,520/mo you\'re donating to Microsoft. You\'re welcome for catching that.',
			liner: '"You didn\'t have inactive users. You had a charity program for Redmond."'
		},
		{
			q: 'Which tenants have the worst security?',
			a: 'Contoso Ltd: 34/100 Secure Score. 8 critical CIS controls failing. MFA disabled for 60% of admins. This is… not great. This is the opposite of great.',
			liner: '"Every admin thinks they\'re doing a great job… until TenantIQ shows up."'
		},
		{
			q: 'Show me license waste across all tenants',
			a: 'Total waste: $8,430/mo across 6 tenants. Top offender: Fabrikam with 45 unused E3 licenses and 12 duplicate assignments. That\'s a luxury car payment. Monthly.',
			liner: '"We don\'t create problems. We just reveal the ones you\'ve been ignoring."'
		}
	];
</script>

<section class="ai-section" id="ai">
	<div class="section-header">
		<span class="label">The AI That Judges You</span>
		<h2>Ask TenantIQ Anything<br/><span class="sub-head">(Brace Yourself)</span></h2>
		<p>Natural language queries powered by 13+ specialized AI tools. It doesn't sugarcoat anything.</p>
	</div>
	<div class="chat-window">
		<div class="chat-bar">
			<div class="dots"><span></span><span></span><span></span></div>
			<span class="bar-title">TenantIQ AI Agent</span>
			<span class="badge">Brutally Honest</span>
		</div>
		<div class="messages">
			{#each queries as msg}
				<div class="bubble user">{msg.q}</div>
				<div class="bubble ai">
					{msg.a}
					<span class="bubble-liner">{msg.liner}</span>
				</div>
			{/each}
		</div>
	</div>
	<div class="ai-cta">
		<a href="https://app.tenantiq.app" class="btn-cta">
			Ask TenantIQ About My Tenants <span>(I Can Handle It)</span>
		</a>
	</div>
</section>

<style>
	.ai-section { padding: 6rem 5%; max-width: 900px; margin: 0 auto; }
	.section-header { text-align: center; margin-bottom: 3rem; }
	.label { display: inline-block; padding: 0.35rem 1rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 999px; font-size: 0.8rem; color: #ef4444; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1rem; }
	.section-header h2 { font-size: 2.75rem; font-weight: 700; margin-bottom: 1rem; }
	.sub-head { font-size: 1.5rem; color: #f59e0b; font-style: italic; font-weight: 500; }
	.section-header p { font-size: 1.15rem; color: #94a3b8; }
	.chat-window { background: rgba(255,255,255,0.02); border: 1px solid rgba(239,68,68,0.15); border-radius: 20px; overflow: hidden; backdrop-filter: blur(20px); }
	.chat-bar { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
	.dots { display: flex; gap: 6px; }
	.dots span { width: 10px; height: 10px; border-radius: 50%; background: #334155; }
	.bar-title { flex: 1; font-weight: 600; font-size: 0.9rem; }
	.badge { padding: 0.25rem 0.75rem; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 999px; font-size: 0.75rem; color: #ef4444; font-weight: 600; }
	.messages { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
	.bubble { padding: 0.85rem 1.25rem; border-radius: 14px; font-size: 0.925rem; line-height: 1.5; max-width: 85%; }
	.bubble.user { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.2); color: #d1fae5; align-self: flex-end; }
	.bubble.ai { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #e2e8f0; align-self: flex-start; }
	.bubble-liner { display: block; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem; color: #f59e0b; font-style: italic; }

	.ai-cta { text-align: center; margin-top: 2.5rem; }
	.btn-cta { display: inline-flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; font-size: 1.05rem; font-weight: 600; border-radius: 12px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; text-decoration: none; transition: all 0.3s ease; }
	.btn-cta:hover { transform: translateY(-2px); box-shadow: 0 20px 40px rgba(239,68,68,0.35); }
	.btn-cta span { font-weight: 400; opacity: 0.8; font-size: 0.9rem; }

	@media (max-width: 768px) { .section-header h2 { font-size: 2rem; } .bubble { max-width: 95%; } }
</style>

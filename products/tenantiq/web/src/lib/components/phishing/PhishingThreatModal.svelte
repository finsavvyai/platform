<script lang="ts">
	import type { Threat } from './phishing-types';

	let { threat, onclose }: { threat: Threat; onclose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} />
<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="threat-modal-title">
	<button type="button" class="overlay-button" onclick={onclose} aria-label="Close dialog"></button>
	<div class="modal-content">
		<div class="modal-header">
			<h3 id="threat-modal-title">Threat Details</h3>
			<button class="modal-close" onclick={onclose}>x</button>
		</div>
		<div class="modal-body">
			<div class="detail-row">
				<span class="detail-label">Threat Type:</span>
				<span class="detail-value">{threat.threatType}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Subject:</span>
				<span class="detail-value">{threat.subject}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Sender:</span>
				<span class="detail-value sender">{threat.sender}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Received:</span>
				<span class="detail-value">{new Date(threat.receivedAt).toLocaleString()}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Confidence:</span>
				<span class="detail-value confidence">{threat.confidence}%</span>
			</div>
			<div class="indicators-section">
				<h4>Threat Indicators</h4>
				<ul class="indicators-list">
					{#each threat.indicators as indicator}
						<li>{indicator}</li>
					{/each}
				</ul>
			</div>
			<div class="action-buttons">
				<button class="btn-danger">Quarantine Email</button>
				<button class="btn-secondary">Report False Positive</button>
			</div>
		</div>
	</div>
</div>

<style>
	.modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
	.overlay-button { position: absolute; inset: 0; background: transparent; border: 0; cursor: default; padding: 0; }
	.modal-content { position: relative; background: #1a1a1a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; }
	.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
	.modal-header h3 { margin: 0; font-size: 1.5rem; color: #ffffff; }
	.modal-close { background: none; border: none; color: #9ca3af; font-size: 2rem; cursor: pointer; line-height: 1; padding: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: all 0.2s; }
	.modal-close:hover { background: rgba(255, 255, 255, 0.1); color: #ffffff; }
	.modal-body { padding: 1.5rem; }
	.detail-row { display: grid; grid-template-columns: 140px 1fr; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
	.detail-label { font-weight: 600; color: #9ca3af; font-size: 0.875rem; }
	.detail-value { color: #ffffff; font-size: 0.875rem; }
	.detail-value.sender { color: #ef4444; font-family: monospace; }
	.detail-value.confidence { color: #22c55e; font-weight: 600; }
	.indicators-section { margin-top: 1.5rem; }
	.indicators-section h4 { margin: 0 0 0.75rem 0; font-size: 1rem; color: #ffffff; }
	.indicators-list { list-style: none; padding: 0; margin: 0; }
	.indicators-list li { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.5rem; color: #fca5a5; font-size: 0.875rem; }
	.action-buttons { display: flex; gap: 1rem; margin-top: 1.5rem; }
	.btn-danger { flex: 1; background: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
	.btn-danger:hover { background: #dc2626; transform: translateY(-1px); }
	.btn-secondary { flex: 1; background: rgba(255, 255, 255, 0.05); color: #d1d5db; border: 1px solid rgba(255, 255, 255, 0.1); padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
	.btn-secondary:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
	@media (max-width: 768px) { .detail-row { grid-template-columns: 1fr; gap: 0.25rem; } .action-buttons { flex-direction: column; } }
</style>

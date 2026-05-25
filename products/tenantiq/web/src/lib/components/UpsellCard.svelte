<script lang="ts">
	/**
	 * Renders a license-upgrade-required upsell when an API returns 402 with
	 *   { code: 'LICENSE_UPGRADE_REQUIRED', upsell: { required, suggestedSeats, estimatedMonthlyCostUsd } }
	 * Intercept the 402 response in your route handler and pass the body here.
	 */
	import { Lock, ExternalLink } from 'lucide-svelte';

	interface RequiredSku {
		display: string;       // "Entra ID P1"
		reason: string;
		priceUsdPerUserPerMonth: number;
		anyOf: string[];
	}

	interface Upsell {
		required: RequiredSku;
		suggestedSeats: number;
		estimatedMonthlyCostUsd: number;
	}

	interface Props {
		message?: string;
		upsell: Upsell;
		onDismiss?: () => void;
	}

	let { message, upsell, onDismiss }: Props = $props();
</script>

<div class="upsell-card" role="alert">
	<div class="upsell-icon"><Lock size={20} /></div>
	<div class="upsell-body">
		<h3 class="upsell-title">{upsell.required.display} required</h3>
		<p class="upsell-message">{message ?? upsell.required.reason}</p>
		<div class="upsell-pricing">
			<div class="pricing-block">
				<span class="pricing-label">Recommended seats</span>
				<span class="pricing-value">{upsell.suggestedSeats}</span>
			</div>
			<div class="pricing-block">
				<span class="pricing-label">Est. monthly cost</span>
				<span class="pricing-value">${upsell.estimatedMonthlyCostUsd.toLocaleString()}</span>
				<span class="pricing-meta">${upsell.required.priceUsdPerUserPerMonth}/user/mo</span>
			</div>
		</div>
		<div class="upsell-actions">
			<a href="/settings#billing" class="btn-upgrade">
				Upgrade to {upsell.required.display}
				<ExternalLink size={14} />
			</a>
			{#if onDismiss}
				<button type="button" class="btn-dismiss" onclick={onDismiss}>Maybe later</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.upsell-card {
		display: flex;
		gap: 0.875rem;
		padding: 1rem;
		border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
		border-radius: 0.75rem;
		background: linear-gradient(135deg,
			color-mix(in srgb, var(--color-primary) 8%, var(--color-surface)),
			color-mix(in srgb, var(--color-primary) 4%, var(--color-surface))
		);
	}
	.upsell-icon {
		flex-shrink: 0;
		width: 2.5rem; height: 2.5rem;
		display: flex; align-items: center; justify-content: center;
		border-radius: 0.5rem;
		background: var(--color-primary);
		color: white;
	}
	.upsell-body { flex: 1; min-width: 0; }
	.upsell-title { margin: 0; font-size: 0.9375rem; font-weight: 600; color: var(--color-text); }
	.upsell-message { margin: 0.25rem 0 0.75rem 0; font-size: 0.8125rem; color: var(--color-text-secondary); line-height: 1.4; }
	.upsell-pricing {
		display: flex; gap: 1.5rem; margin: 0.75rem 0;
		padding: 0.625rem 0.875rem;
		background: color-mix(in srgb, var(--color-surface) 70%, transparent);
		border-radius: 0.5rem;
	}
	.pricing-block { display: flex; flex-direction: column; gap: 0.125rem; }
	.pricing-label { font-size: 0.6875rem; font-weight: 500; text-transform: uppercase; color: var(--color-primary); letter-spacing: 0.025em; }
	.pricing-value { font-size: 1.125rem; font-weight: 700; color: var(--color-text); }
	.pricing-meta { font-size: 0.6875rem; color: var(--color-text-secondary); }
	.upsell-actions { display: flex; gap: 0.5rem; align-items: center; }
	.btn-upgrade {
		display: inline-flex; align-items: center; gap: 0.375rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.5rem;
		background: var(--color-primary);
		color: white;
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
	}
	.btn-upgrade:hover { background: color-mix(in srgb, var(--color-primary) 85%, black); }
	.btn-dismiss {
		padding: 0.5rem 0.875rem;
		border: none;
		background: transparent;
		color: var(--color-primary);
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.btn-dismiss:hover { color: color-mix(in srgb, var(--color-primary) 85%, black); }
</style>

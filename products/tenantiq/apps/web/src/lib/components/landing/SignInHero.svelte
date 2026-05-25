<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isWebAuthnSupported, authenticateWithPasskey } from '$utils/webauthn-client';
	import { auth } from '$stores/auth';

	const API_BASE = import.meta.env.PUBLIC_API_URL ?? 'https://api.tenantiq.app';

	let passkeySupported = $state(false);
	let signingIn = $state(false);

	onMount(async () => { passkeySupported = await isWebAuthnSupported(); });

	async function signInWithPasskey() {
		signingIn = true;
		try {
			const result = await authenticateWithPasskey();
			if (result) {
				auth.setUser({
					...result.user,
					name: result.user.email,
					role: (result.user.role as 'viewer' | 'operator' | 'admin' | 'platform_admin' | 'super_admin') ?? 'viewer',
					organizationId: '',
					tenantIds: [],
				});
				goto('/');
			}
		} finally {
			signingIn = false;
		}
	}
</script>

<div class="hero">
	<div class="mesh"></div>
	<div class="orbs">
		<div class="orb orb-1"></div>
		<div class="orb orb-2"></div>
		<div class="orb orb-3"></div>
	</div>

	<div class="hero-inner">
		<div class="left">
			<span class="eyebrow">
				<span class="dot"></span>
				AI-Powered M365 Platform
			</span>

			<h1>M365 security,<br /><span class="accent">on autopilot.</span></h1>

			<p class="subtitle">AI-powered compliance, threat detection, and license optimization — across every tenant you manage.</p>

			<div class="stats">
				<div><span class="stat-val">100+</span><span class="stat-lbl">CIS Controls</span></div>
				<div><span class="stat-val">5</span><span class="stat-lbl">Frameworks</span></div>
				<div><span class="stat-val">13+</span><span class="stat-lbl">AI Tools</span></div>
			</div>

			<div class="trust">
				<span class="trust-item">SOC 2</span>
				<span class="trust-item">HIPAA</span>
				<span class="trust-item">GDPR</span>
				<span class="trust-item">Zero Trust</span>
			</div>
		</div>

		<div class="right">
			<div class="card">
				<img src="/brand/logo-mark.png" alt="" aria-hidden="true" class="card-logo" width="56" height="56" />
				<h2 class="card-title">Sign in</h2>
				<p class="card-sub">Secure access to your MSP console</p>

				{#if passkeySupported}
					<button type="button" onclick={signInWithPasskey} disabled={signingIn} class="btn-passkey">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2"/>
						</svg>
						{signingIn ? 'Authenticating…' : 'Sign in with passkey'}
					</button>
				{/if}
				<a href="{API_BASE}/api/auth/login" class="btn-ms">
					<svg width="20" height="20" viewBox="0 0 23 23"><path fill="#f25022" d="M1 1h10v10H1z"/><path fill="#00a4ef" d="M1 12h10v10H1z"/><path fill="#7fba00" d="M12 1h10v10H12z"/><path fill="#ffb900" d="M12 12h10v10H12z"/></svg>
					Sign in with Microsoft
				</a>

				<a href="{API_BASE}/api/auth/login/personal" class="btn-personal">
					Try with my M365 account only
					<span class="badge-mini">no admin needed</span>
				</a>

				<a href="{API_BASE}/api/auth/login/linkedin" class="btn-li">
					<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
						<path fill="#ffffff" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0z"/>
					</svg>
					Sign in with LinkedIn
				</a>

				<div class="card-divider"><span>for IT admins</span></div>
				<a href="{API_BASE}/api/auth/login" class="btn-onboard">
					Onboard your organization <span class="arrow">→</span>
				</a>
				<p class="onboard-hint">Global Admin sign-in grants tenant-wide Graph scopes once. New to TenantIQ? Just sign in — your account is created automatically.</p>
			</div>

			<div class="status-bar">
				<span class="status-dot"></span>
				Security scan running across tenants
			</div>
		</div>
	</div>
</div>

<style>
	.hero {
		position: relative;
		min-height: 100vh;
		background: var(--color-bg);
		color: var(--color-text);
		overflow: hidden;
		display: flex;
		align-items: center;
	}

	/* Ambient mesh — brand gradient */
	.mesh {
		position: absolute; inset: 0; pointer-events: none;
		background:
			radial-gradient(ellipse 70% 50% at 25% 20%, rgb(59 108 245 / 0.08) 0%, transparent 60%),
			radial-gradient(ellipse 60% 40% at 75% 70%, rgb(124 58 237 / 0.06) 0%, transparent 50%),
			radial-gradient(ellipse 40% 30% at 50% 50%, rgb(20 184 166 / 0.04) 0%, transparent 50%);
	}

	/* Floating orbs — Decart-style ambient light */
	.orbs { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
	.orb {
		position: absolute;
		border-radius: 50%;
		filter: blur(80px);
		opacity: 0.6;
		animation: float-orb 20s ease-in-out infinite;
	}
	.orb-1 { width: 400px; height: 400px; background: rgb(59 108 245 / 0.15); top: -10%; left: 10%; animation-delay: 0s; }
	.orb-2 { width: 300px; height: 300px; background: rgb(124 58 237 / 0.12); bottom: -5%; right: 15%; animation-delay: -7s; }
	.orb-3 { width: 200px; height: 200px; background: rgb(20 184 166 / 0.1); top: 40%; right: 30%; animation-delay: -13s; }
	@keyframes float-orb {
		0%, 100% { transform: translate(0, 0) scale(1); }
		33% { transform: translate(30px, -20px) scale(1.05); }
		66% { transform: translate(-20px, 15px) scale(0.95); }
	}

	.hero-inner {
		position: relative; z-index: 1;
		display: grid; grid-template-columns: 1fr 400px; gap: 4rem;
		max-width: 1100px; width: 100%; padding: 2rem 5%; margin: 0 auto; align-items: center;
	}

	.eyebrow {
		display: inline-flex; align-items: center; gap: 0.5rem;
		padding: 0.4rem 1rem; border: 1px solid rgb(59 108 245 / 0.2);
		border-radius: 999px; font-size: 0.7rem; font-weight: 600;
		color: var(--color-text-secondary); margin-bottom: 2rem;
		background: rgb(59 108 245 / 0.06);
		letter-spacing: 0.04em; text-transform: uppercase;
	}
	.dot {
		width: 6px; height: 6px; border-radius: 50%;
		background: var(--brand-500);
		box-shadow: 0 0 8px rgb(59 108 245 / 0.6);
		animation: dot-pulse 2s ease-in-out infinite;
	}
	@keyframes dot-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 8px rgb(59 108 245 / 0.6); } 50% { opacity: 0.6; box-shadow: 0 0 16px rgb(59 108 245 / 0.4); } }

	h1 {
		font-size: clamp(2.75rem, 5vw, 4rem);
		font-weight: 800;
		line-height: 1.06;
		letter-spacing: -0.04em;
		color: var(--color-text);
		margin-bottom: 1.25rem;
	}
	.accent {
		background: linear-gradient(135deg, var(--brand-400), var(--brand-600), #7c3aed);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		font-size: 1.05rem;
		color: var(--color-text-secondary);
		line-height: 1.7;
		margin-bottom: 2.5rem;
		max-width: 440px;
	}

	.stats { display: flex; gap: 2.5rem; margin-bottom: 1.5rem; }
	.stat-val {
		display: block; font-size: 1.75rem; font-weight: 800;
		color: var(--color-text); letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.stat-lbl {
		display: block; font-size: 0.6rem; font-weight: 600;
		color: var(--color-text-tertiary);
		letter-spacing: 0.08em; text-transform: uppercase; margin-top: 0.15rem;
	}

	.trust { display: flex; flex-wrap: wrap; gap: 0.4rem; }
	.trust-item {
		padding: 0.3rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 0.6rem; font-weight: 600;
		color: var(--color-text-tertiary);
		letter-spacing: 0.04em;
		background: var(--color-surface-glass);
		backdrop-filter: blur(8px);
	}

	.right { display: flex; flex-direction: column; gap: 0.75rem; }

	.card {
		background: var(--color-surface-glass);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: 2.25rem;
		box-shadow: var(--shadow-lg);
	}
	.card-logo { display: block; margin: 0 auto 0.9rem; border-radius: 14px; box-shadow: 0 10px 30px rgb(79 70 229 / 0.25); }
	.card-title {
		font-size: 1.35rem; font-weight: 800;
		color: var(--color-text); margin-bottom: 0.2rem;
		letter-spacing: -0.03em;
		text-align: center;
	}
	.card-sub { font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 1.75rem; text-align: center; }

	.btn-passkey {
		display: flex; align-items: center; justify-content: center; gap: 0.65rem;
		width: 100%; padding: 0.8rem; margin-bottom: 0.6rem;
		background: linear-gradient(135deg, rgb(34 197 94 / 0.12), rgb(20 184 166 / 0.10));
		border: 1px solid rgb(34 197 94 / 0.30);
		border-radius: var(--radius-lg);
		color: var(--color-text); font-size: 0.875rem; font-weight: 600;
		cursor: pointer; transition: all 0.3s ease; min-height: 48px;
	}
	.btn-passkey:hover:not(:disabled) {
		background: linear-gradient(135deg, rgb(34 197 94 / 0.2), rgb(20 184 166 / 0.15));
		border-color: rgb(34 197 94 / 0.5);
		box-shadow: 0 0 32px rgb(34 197 94 / 0.15);
		transform: translateY(-1px);
	}
	.btn-passkey:disabled { opacity: 0.6; cursor: wait; }

	.btn-ms {
		display: flex; align-items: center; justify-content: center; gap: 0.65rem;
		width: 100%; padding: 0.8rem;
		background: linear-gradient(135deg, rgb(59 108 245 / 0.1), rgb(124 58 237 / 0.08));
		border: 1px solid rgb(59 108 245 / 0.25);
		border-radius: var(--radius-lg);
		color: var(--color-text); font-size: 0.875rem; font-weight: 600;
		text-decoration: none; transition: all 0.3s ease; min-height: 48px;
	}
	.btn-ms:hover {
		background: linear-gradient(135deg, rgb(59 108 245 / 0.18), rgb(124 58 237 / 0.12));
		border-color: rgb(59 108 245 / 0.45);
		box-shadow: 0 0 32px rgb(59 108 245 / 0.15);
		transform: translateY(-1px);
	}

	.btn-li {
		display: flex; align-items: center; justify-content: center; gap: 0.65rem;
		width: 100%; padding: 0.8rem; margin-top: 0.6rem;
		background: #0a66c2;
		border: 1px solid #0a66c2;
		border-radius: var(--radius-lg);
		color: #ffffff; font-size: 0.875rem; font-weight: 600;
		text-decoration: none; transition: all 0.3s ease; min-height: 48px;
	}
	.btn-li:hover {
		background: #084c93;
		border-color: #084c93;
		box-shadow: 0 0 32px rgb(10 102 194 / 0.25);
		transform: translateY(-1px);
	}

	.btn-personal {
		display: flex; align-items: center; justify-content: center; gap: 0.5rem;
		width: 100%; padding: 0.75rem; margin-top: 0.6rem;
		background: transparent;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-text); font-size: 0.8rem; font-weight: 500;
		text-decoration: none; transition: all 0.2s; min-height: 44px;
	}
	.btn-personal:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
	.badge-mini {
		font-size: 0.65rem; padding: 0.1rem 0.45rem; border-radius: 999px;
		background: var(--color-success)/0.1; color: var(--color-success);
		font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
	}
	.card-divider {
		display: flex; align-items: center; gap: 0.75rem;
		margin: 1.2rem 0 0.5rem;
		font-size: 0.7rem; color: var(--color-text-tertiary);
		text-transform: uppercase; letter-spacing: 0.08em;
	}
	.card-divider::before, .card-divider::after { content: ''; flex: 1; height: 1px; background: var(--color-border-subtle); }
	.btn-onboard {
		display: flex; align-items: center; justify-content: space-between;
		width: 100%; padding: 0.75rem 1rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		color: var(--color-text); font-size: 0.8rem; font-weight: 600;
		text-decoration: none; transition: all 0.2s; min-height: 44px;
	}
	.btn-onboard:hover {
		border-color: var(--color-primary);
		background: var(--color-primary)/0.05;
	}
	.btn-onboard .arrow { transition: transform 0.2s; }
	.btn-onboard:hover .arrow { transform: translateX(3px); }
	.onboard-hint { font-size: 0.7rem; color: var(--color-text-tertiary); text-align: center; margin-top: 0.3rem; }

	.status-bar {
		display: flex; align-items: center; gap: 0.4rem;
		padding: 0.65rem 1rem; border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-lg); font-size: 0.75rem;
		color: var(--color-text-tertiary);
		background: var(--color-surface-glass);
		backdrop-filter: blur(8px);
	}
	.status-dot {
		width: 6px; height: 6px; border-radius: 50%;
		background: var(--color-success);
		box-shadow: 0 0 6px rgb(34 197 94 / 0.5);
		animation: dot-pulse 2s infinite;
	}

	@media (prefers-reduced-motion: reduce) { .status-dot, .dot { animation: none; } .orb { animation: none; } }
	@media (max-width: 1024px) { .hero-inner { grid-template-columns: 1fr 360px; gap: 2.5rem; } }
	@media (max-width: 768px) { .hero { align-items: start; } .hero-inner { grid-template-columns: 1fr; max-width: 480px; padding-top: 3rem; padding-bottom: 7rem; } .orb-1 { width: 250px; height: 250px; } .orb-2 { width: 200px; height: 200px; } .orb-3 { display: none; } }
	@media (max-width: 480px) { .stats { gap: 1.5rem; } .stat-val { font-size: 1.35rem; } .card { padding: 1.5rem; } .hero-inner { padding-bottom: 8rem; } }
</style>

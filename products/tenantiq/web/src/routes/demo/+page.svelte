<script lang="ts">
	import { LOGIN_URL } from '$lib/config';
	import { Play, ArrowLeft } from 'lucide-svelte';

	const videos = [
		{ id: 'trailer', title: 'Product Trailer', duration: '60s', description: 'Cinematic overview of the platform' },
		{ id: 'explainer', title: 'How It Works', duration: '2 min', description: 'Step-by-step walkthrough from connect to compliant' },
		{ id: 'social', title: 'Social Clip', duration: '30s', description: 'Short-form vertical clip for sharing' },
		{ id: 'ad', title: 'Feature Showcase', duration: '20s', description: 'Quick highlights of key capabilities' },
	];

	let activeVideo = $state<string | null>(null);
</script>

<svelte:head>
	<title>Demo — TenantIQ</title>
	<meta name="description" content="Watch TenantIQ in action — see how MSPs use AI-powered CIS benchmarks, threat detection, and license optimization to manage Microsoft 365 tenants." />
	<link rel="canonical" href="https://app.tenantiq.app/demo" />
</svelte:head>

<div class="page">
	<div class="mesh"></div>
	<div class="inner">
		<nav class="nav">
			<a href="/home" class="back"><ArrowLeft size={15} /> Back</a>
		</nav>

		<header class="header">
			<span class="eyebrow">Product demos</span>
			<h1>See TenantIQ in action.</h1>
			<p>Watch how MSPs secure and optimize Microsoft 365 tenants.</p>
		</header>

		{#if activeVideo}
			<div class="player" role="dialog" aria-label="Video player">
				<button class="player-close" onclick={() => (activeVideo = null)}>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
					Close
				</button>
				<iframe src="/video-{activeVideo}.htm" title="{activeVideo} video" class="player-frame" allowfullscreen></iframe>
			</div>
		{/if}

		<div class="grid">
			{#each videos as video}
				<button class="card" onclick={() => (activeVideo = video.id)}>
					<div class="card-cover">
						<div class="play-circle"><Play size={24} /></div>
					</div>
					<div class="card-body">
						<div class="card-meta">
							<h3>{video.title}</h3>
							<span class="badge">{video.duration}</span>
						</div>
						<p>{video.description}</p>
					</div>
				</button>
			{/each}
		</div>

		<footer class="cta">
			<h2>Ready to take control?</h2>
			<a href="{LOGIN_URL}" class="btn">Start free trial
				<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10m0 0L9 4m4 4L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
			</a>
			<p class="sub">14-day free trial. No credit card required.</p>
		</footer>
	</div>
</div>

<style>
	.page { min-height: 100vh; background: #060b0f; color: #f1f5f9; position: relative; overflow: hidden; }
	.mesh { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.08) 0%, transparent 60%); pointer-events: none; }
	.inner { position: relative; z-index: 1; max-width: 1000px; margin: 0 auto; padding: 2rem 5% 4rem; }

	.nav { margin-bottom: 3rem; }
	.back { display: inline-flex; align-items: center; gap: 0.4rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: color 0.15s; }
	.back:hover { color: #e2e8f0; }

	.header { text-align: center; margin-bottom: 3.5rem; }
	.eyebrow { display: inline-block; padding: 0.3rem 0.9rem; border: 1px solid rgba(16,185,129,0.15); border-radius: 999px; font-size: 0.7rem; color: #10b981; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 1.25rem; }
	.header h1 { font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.6rem; }
	.header p { color: #64748b; font-size: 1rem; }

	.player { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.92); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }
	.player-close { position: absolute; top: 1.25rem; right: 1.25rem; display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; font-size: 0.8rem; font-weight: 500; }
	.player-close:hover { background: rgba(255,255,255,0.1); }
	.player-frame { width: min(90vw, 1000px); height: min(80vh, 562px); border: none; border-radius: 12px; }

	.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 5rem; }

	.card {
		background: rgba(255,255,255,0.02);
		border: 1px solid rgba(255,255,255,0.06);
		border-radius: 16px;
		overflow: hidden;
		text-align: left;
		cursor: pointer;
		transition: border-color 0.3s, box-shadow 0.3s;
		color: inherit;
	}
	.card:hover { border-color: rgba(16,185,129,0.25); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
	.card:hover .play-circle { box-shadow: 0 0 24px rgba(16,185,129,0.2); transform: scale(1.05); }

	.card-cover {
		height: 160px;
		background: linear-gradient(135deg, rgba(16,185,129,0.04), rgba(6,11,15,0.8));
		display: flex; align-items: center; justify-content: center;
	}
	.play-circle {
		width: 52px; height: 52px;
		border-radius: 50%;
		background: rgba(16,185,129,0.1);
		border: 1px solid rgba(16,185,129,0.2);
		display: flex; align-items: center; justify-content: center;
		color: #10b981;
		transition: all 0.3s ease;
	}

	.card-body { padding: 1.25rem; }
	.card-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.3rem; }
	.card-meta h3 { font-size: 0.95rem; font-weight: 650; color: #e2e8f0; letter-spacing: -0.01em; }
	.badge { font-size: 0.6rem; padding: 0.15rem 0.5rem; border: 1px solid rgba(16,185,129,0.15); border-radius: 999px; color: #10b981; font-weight: 600; }
	.card-body p { font-size: 0.8rem; color: #64748b; line-height: 1.5; }

	.cta { text-align: center; }
	.cta h2 { font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 1.5rem; }
	.btn {
		display: inline-flex; align-items: center; gap: 0.5rem;
		padding: 0.85rem 2rem; background: #10b981; color: #fff;
		font-weight: 600; font-size: 0.95rem; border-radius: 10px;
		text-decoration: none; transition: all 0.2s; min-height: 48px;
	}
	.btn:hover { background: #059669; box-shadow: 0 0 32px rgba(16,185,129,0.3); }
	.sub { margin-top: 0.75rem; font-size: 0.75rem; color: #475569; }

	@media (max-width: 640px) {
		.grid { grid-template-columns: 1fr; }
		.card-cover { height: 140px; }
		.inner { padding: 1.5rem 4% 3rem; }
	}
</style>

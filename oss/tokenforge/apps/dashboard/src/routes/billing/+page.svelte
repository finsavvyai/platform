<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-5">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Billing</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Current plan: <span class="text-zinc-200 uppercase">{data.tenant.plan}</span>
    </p>
  </header>

  <div class="grid gap-4 md:grid-cols-3">
    {#each data.plans as plan (plan.id)}
      <div class="rounded border border-zinc-800 bg-zinc-900/40 p-5"
        class:border-zinc-500={plan.id === data.tenant.plan}>
        <p class="text-xs uppercase tracking-wider text-zinc-500">{plan.name}</p>
        <p class="mt-1 text-2xl font-semibold">{plan.price}</p>
        <ul class="mt-3 space-y-1 text-sm text-zinc-400">
          {#each plan.features as f (f)}
            <li>· {f}</li>
          {/each}
        </ul>
        {#if plan.id === data.tenant.plan}
          <p class="mt-4 text-xs text-zinc-500">Current plan</p>
        {:else if plan.cta}
          <a href="https://checkout.lemonsqueezy.com/buy/{plan.cta}"
            class="mt-4 inline-block rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
            Upgrade
          </a>
        {/if}
      </div>
    {/each}
  </div>

  <p class="text-xs text-zinc-500">
    LemonSqueezy webhook handling lands in Phase 6.1; the plan column is updated server-side once a
    <code class="text-zinc-300">subscription_created</code> event arrives.
  </p>
</section>

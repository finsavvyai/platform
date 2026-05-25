<script lang="ts">
  import type { PageData } from './$types.js';
  let { data }: { data: PageData } = $props();
</script>

<section class="max-w-2xl space-y-4">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">App created — {data.app.name}</h1>
    <p class="mt-1 text-sm text-zinc-400">
      Origin: <code class="text-zinc-300">{data.app.origin}</code>
    </p>
  </header>

  {#if data.liveKey}
    <div class="space-y-3 rounded border border-amber-700 bg-amber-950/40 p-5">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-amber-300">
        Your live API key — shown once
      </h2>
      <p class="text-sm text-amber-200/80">
        Copy it now. We never display it again. Treat it like a password.
      </p>
      <pre class="overflow-x-auto rounded border border-amber-800 bg-zinc-950 p-3 text-sm text-amber-200">{data.liveKey}</pre>
      <p class="text-xs text-amber-200/60">
        Pair this with <code class="text-amber-200">@tokenforge/hono</code> as <code class="text-amber-200">apiKey</code>.
      </p>
    </div>
  {:else}
    <div class="rounded border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
      The reveal window has expired. Rotate the key from the app settings to issue a new one.
    </div>
  {/if}

  <a href="/apps/{data.app.id}" class="inline-block text-sm text-zinc-300 hover:underline">
    Continue to app overview →
  </a>
</section>

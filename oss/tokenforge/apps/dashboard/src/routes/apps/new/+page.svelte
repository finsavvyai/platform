<script lang="ts">
  import type { ActionData } from './$types.js';
  let { form }: { form: ActionData } = $props();
</script>

<section class="max-w-xl space-y-4">
  <header>
    <a href="/apps" class="text-xs text-zinc-500 hover:text-zinc-300">&larr; Apps</a>
    <h1 class="mt-1 text-2xl font-semibold tracking-tight">Create app</h1>
    <p class="mt-1 text-sm text-zinc-400">
      The API key will be shown <em>once</em> on the next page. Store it before navigating away.
    </p>
  </header>

  <form method="POST" class="space-y-4 rounded border border-zinc-800 bg-zinc-900/40 p-5">
    <label class="block">
      <span class="text-sm text-zinc-400">App name</span>
      <input name="name" required placeholder="My SaaS App"
        class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500" />
    </label>

    <label class="block">
      <span class="text-sm text-zinc-400">Origin</span>
      <input name="origin" required placeholder="https://app.example.com"
        class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500" />
      <span class="mt-1 block text-xs text-zinc-500">Must start with <code>https://</code>.</span>
    </label>

    <label class="block">
      <span class="text-sm text-zinc-400">Mode</span>
      <select name="mode"
        class="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-500">
        <option value="customer">Customer (B2C)</option>
        <option value="workforce">Workforce (B2B)</option>
      </select>
    </label>

    {#if form?.error}
      <p class="text-sm text-red-400">{form.error}</p>
    {/if}

    <button type="submit"
      class="rounded border border-zinc-700 bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white">
      Create app
    </button>
  </form>
</section>

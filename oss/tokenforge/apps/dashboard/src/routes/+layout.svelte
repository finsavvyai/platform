<script lang="ts">
  let { children } = $props();
</script>

<header class="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
  <div class="mx-auto flex max-w-6xl items-center justify-between">
    <a href="/" class="text-lg font-semibold tracking-tight text-zinc-100">TokenForge</a>
    <nav class="flex gap-6 text-sm text-zinc-400">
      <a href="/apps" class="hover:text-zinc-100">Apps</a>
      <a href="/sessions" class="hover:text-zinc-100">Sessions</a>
      <a href="/audit" class="hover:text-zinc-100">Audit</a>
      <a href="/billing" class="hover:text-zinc-100">Billing</a>
    </nav>
  </div>
</header>

<main class="mx-auto max-w-6xl px-6 py-10">
  {@render children?.()}
</main>

<style>
  :global(body) {
    background: #09090b;
    color: #e4e4e7;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    margin: 0;
  }
</style>

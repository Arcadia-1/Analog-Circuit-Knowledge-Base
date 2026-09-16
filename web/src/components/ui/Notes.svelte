<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
  let open = $state(false);
  let root: HTMLDetailsElement;
  function onDocPointer(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) open = false;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:document onpointerdown={onDocPointer} onkeydown={onKey} />

<details class="notes" bind:this={root} bind:open>
  <summary>Model notes</summary>
  <div class="panel">{@render children()}</div>
</details>

<style>
  .notes { position: relative; align-self: center; }
  summary { list-style: none; cursor: pointer; font-size: 13px; color: var(--ink-2); padding: 4px 12px; border: 1px solid var(--rule); border-radius: 999px; white-space: nowrap; }
  summary::-webkit-details-marker { display: none; }
  .notes[open] summary { color: var(--ink); border-color: var(--ink-3); }
  .panel { position: absolute; right: 0; top: calc(100% + 8px); width: min(540px, 88vw); background: var(--plot); border: 1px solid var(--rule); border-radius: 10px; padding: 14px 16px; box-shadow: 0 14px 36px rgba(10, 14, 20, 0.16); z-index: 20; color: var(--ink-2); font-size: 13px; line-height: 1.55; }
  .panel :global(p) { margin: 0 0 8px; }
  .panel :global(p:last-child) { margin: 0; }
  .panel :global(b) { color: var(--ink); font-weight: 500; }
  .panel :global(code) { font: 11.5px var(--mono); color: var(--ink); background: var(--chip); padding: 0 4px; border-radius: 4px; }
  .panel :global(a) { color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--rule); }
  .panel :global(a:hover) { border-bottom-color: var(--ink-3); }
  @media (max-width: 900px) { .panel { left: 0; right: auto; } }
</style>

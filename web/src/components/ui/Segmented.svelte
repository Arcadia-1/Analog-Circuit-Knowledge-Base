<script lang="ts" module>
  export interface SegOption<V> {
    value: V;
    label: string;
  }
</script>

<script lang="ts" generics="T extends string | number">
  let {
    options,
    value = $bindable(),
    label,
    size = 'md',
    mono = false,
  }: { options: SegOption<T>[]; value: T; label: string; size?: 'sm' | 'md'; mono?: boolean } = $props();
</script>

<div class="seg {size}" class:mono role="group" aria-label={label}>
  {#each options as o (o.value)}
    <button type="button" aria-pressed={o.value === value} onclick={() => (value = o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 8px; padding: 2px; background: var(--plot); }
  button { font: 500 13px/1 var(--sans); color: var(--ink-2); background: transparent; border: 0; border-radius: 6px; padding: 8px 12px; cursor: pointer; white-space: nowrap; }
  button:hover { color: var(--ink); }
  button[aria-pressed='true'] { color: var(--ink); background: var(--accent-soft, var(--chip)); box-shadow: inset 0 0 0 1px var(--accent, var(--ink-3)); }
  .sm button { padding: 5px 10px; font-size: 12.5px; }
  .mono button { font-family: var(--mono); }
  @media (max-width: 900px) {
    .seg { display: flex; width: 100%; }
    button { flex: 1 1 0; padding-inline: 6px; }
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A responsive SVG whose drawing coordinates are the CSS pixels of its box. */
  let { label, children, overlay, onpointermove, onpointerleave }: {
    label: string;
    children: Snippet<[{ width: number; height: number }]>;
    overlay?: Snippet<[{ width: number; height: number }]>;
    onpointermove?: (x: number, width: number, height: number, y: number) => void;
    onpointerleave?: () => void;
  } = $props();

  let width = $state(560);
  let height = $state(240);
</script>

<div class="plot" bind:clientWidth={width} bind:clientHeight={height}>
  <svg
    viewBox="0 0 {width} {height}"
    role="img"
    aria-label={label}
    onpointermove={(e) => {
      const box = e.currentTarget.getBoundingClientRect();
      onpointermove?.(e.clientX - box.left, width, height, e.clientY - box.top);
    }}
    {onpointerleave}
  >
    {@render children({ width, height })}
  </svg>
  {@render overlay?.({ width, height })}
</div>

<style>
  .plot { position: relative; flex: 1 1 auto; min-height: 120px; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; touch-action: pan-y; }
</style>

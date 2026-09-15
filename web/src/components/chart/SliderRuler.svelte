<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A range input laid transparently over a drawn ruler; the snippet draws ticks and marks in pixels of width W. */
  let { value, min, max, step, label, onchange, children }: {
    value: number;
    min: number;
    max: number;
    step: number;
    label: string;
    onchange: (v: number) => void;
    children: Snippet<[{ W: number; X: (v: number) => number }]>;
  } = $props();

  let box = $state(820);
  const W = $derived(box - 20);
  const X = (v: number) => ((v - min) / (max - min)) * W;
</script>

<div class="wrap" bind:clientWidth={box}>
  <svg viewBox="0 0 {W} 64" aria-hidden="true">
    {@render children({ W, X })}
    <line class="handle" x1={X(value)} y1="15" x2={X(value)} y2="41" />
    <circle class="knob" cx={X(value)} cy="28" r="6.5" />
  </svg>
  <input type="range" {min} {max} {step} {value} aria-label={label} oninput={(e) => onchange(parseFloat(e.currentTarget.value))} />
</div>

<style>
  .wrap { position: relative; padding-inline: 10px; }
  svg { display: block; width: 100%; height: 64px; overflow: visible; }
  svg :global(.base) { stroke: var(--rule); stroke-width: 2; }
  svg :global(.tick) { stroke: var(--ink-3); stroke-width: 1; }
  svg :global(.major) { stroke: var(--ink); stroke-width: 2; }
  svg :global(.lane) { stroke-width: 2; opacity: 0.28; }
  .handle { stroke: var(--ink); stroke-width: 1.5; }
  .knob { fill: var(--plot); stroke: var(--ink); stroke-width: 2; }
  input { position: absolute; inset: 16px 0 auto; width: 100%; height: 24px; margin: 0; background: transparent; appearance: none; cursor: ew-resize; }
  input::-webkit-slider-runnable-track { height: 24px; }
  input::-moz-range-track { height: 24px; background: transparent; }
  input::-webkit-slider-thumb { appearance: none; width: 20px; height: 24px; }
  input::-moz-range-thumb { width: 20px; height: 24px; border: 0; background: transparent; }
  input:focus-visible { outline: 2px solid var(--focus); outline-offset: 4px; border-radius: 4px; }
</style>

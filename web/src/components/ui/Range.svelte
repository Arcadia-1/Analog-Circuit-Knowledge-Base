<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    id,
    value = $bindable(),
    min,
    max,
    step = 1,
    output,
    children,
  }: {
    id: string;
    value: number;
    min: number;
    max: number;
    step?: number | 'any';
    output: string;
    children: Snippet;
  } = $props();
</script>

<div class="range">
  <label class="label" for={id}>{@render children()}</label>
  <input {id} type="range" {min} {max} {step} bind:value aria-valuetext={output} />
  <output class="mono" for={id}>{output}</output>
</div>

<style>
  .range { display: flex; align-items: center; gap: 10px; }
  label { white-space: nowrap; }
  input { flex: 0 0 var(--range-width, 130px); width: var(--range-width, 130px); margin: 0; accent-color: var(--accent, var(--ink-2)); cursor: ew-resize; }
  output {
    flex: 0 0 var(--range-output-width, 12ch);
    width: var(--range-output-width, 12ch);
    white-space: nowrap;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }
  @media (max-width: 900px) {
    .range { width: 100%; }
    input { flex: 1 1 auto; width: auto; min-width: 0; }
  }
</style>

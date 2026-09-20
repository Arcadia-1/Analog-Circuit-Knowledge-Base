<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    id,
    value = $bindable(),
    min,
    max,
    step = 1,
    output,
    leading,
    onstart,
    oncommit,
    children,
  }: {
    id: string;
    value: number;
    min: number;
    max: number;
    step?: number | 'any';
    output: string;
    leading?: Snippet;
    onstart?: () => void;
    oncommit?: () => void;
    children: Snippet;
  } = $props();

  function wheel(event: WheelEvent) {
    if (!event.deltaY) return;
    event.preventDefault();
    onstart?.();
    const increment = step === 'any' ? (max - min) / 100 : step;
    const direction = event.deltaY < 0 ? 1 : -1;
    const scale = event.shiftKey ? 10 : 1;
    const index = Math.round((value - min) / increment) + direction * scale;
    const next = Math.min(max, Math.max(min, min + index * increment));
    value = Number(next.toPrecision(12));
    oncommit?.();
  }

  function keydown(event: KeyboardEvent) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) onstart?.();
  }
</script>

<div class="range" class:with-leading={!!leading}>
  <label class="label" for={id}>{@render children()}</label>
  {@render leading?.()}
  <input {id} type="range" {min} {max} {step} bind:value aria-valuetext={output} onpointerdown={() => onstart?.()} onkeydown={keydown} onchange={() => oncommit?.()} onwheel={wheel} title="Drag, use the arrow keys, or scroll to change this value" />
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

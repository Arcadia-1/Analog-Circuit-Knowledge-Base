<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clamp } from '../../lib/scale';

  let {
    id,
    value = $bindable(),
    min,
    max,
    step,
    digits,
    unit,
    prefix = '',
    children,
  }: {
    id: string;
    value: number;
    min: number;
    max: number;
    step: number;
    digits: number;
    unit: string;
    prefix?: string;
    children: Snippet;
  } = $props();

  let draft = $state<string | null>(null);
  const shown = $derived(draft ?? value.toFixed(digits));

  function set(next: number) {
    const bounded = clamp(next, min, max);
    const stepped = min + Math.round((bounded - min) / step) * step;
    value = Number(stepped.toFixed(Math.max(digits, 6)));
  }

  function commit() {
    if (draft === null) return;
    const next = Number.parseFloat(draft.replace(',', '.'));
    draft = null;
    if (Number.isFinite(next)) set(next);
  }

  function keydown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      draft = null;
      e.currentTarget.blur();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      draft = null;
      set(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
    }
  }
</script>

<div class="editable-range">
  <label id="{id}-label" for={id}>{@render children()}</label>
  <input
    id={id}
    class="slider"
    type="range"
    {min}
    {max}
    {step}
    value={value}
    aria-labelledby="{id}-label"
    aria-valuetext="{prefix}{value.toFixed(digits)} {unit}"
    oninput={(e) => set(Number.parseFloat(e.currentTarget.value))}
  />
  <div class="field">
    {#if prefix}<span class="prefix">{prefix}</span>{/if}
    <input
      class="number"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      aria-labelledby="{id}-label"
      value={shown}
      oninput={(e) => (draft = e.currentTarget.value)}
      onblur={commit}
      onkeydown={keydown}
    />
    {#if unit}<span class="unit">{unit}</span>{/if}
  </div>
</div>

<style>
  .editable-range { display: grid; grid-template-columns: 76px minmax(72px, 1fr) 104px; align-items: center; gap: 8px; min-height: 27px; }
  label { color: var(--ink-2); font-size: 12.5px; white-space: nowrap; }
  .slider { width: 100%; min-width: 0; margin: 0; accent-color: var(--accent, var(--ink-2)); cursor: ew-resize; }
  .field { min-width: 0; height: 25px; display: flex; align-items: baseline; justify-content: flex-end; gap: 4px; border-bottom: 1px solid var(--rule); }
  .field:focus-within { border-bottom-color: var(--focus); }
  .number { width: 6ch; min-width: 0; border: 0; outline: 0; padding: 0; margin: 0; background: transparent; color: var(--ink); text-align: right; font: 12.5px/1.4 var(--mono); font-variant-numeric: tabular-nums; }
  .prefix, .unit { color: var(--ink-2); font: 11.5px/1.4 var(--mono); white-space: nowrap; }
  @media (max-width: 520px) {
    .editable-range { grid-template-columns: 70px minmax(64px, 1fr) 96px; }
  }
</style>

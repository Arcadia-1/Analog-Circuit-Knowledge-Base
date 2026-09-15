<script lang="ts">
  /** An editable number: commits on Enter or blur, Esc reverts, ↑/↓ step (Shift: ×10). Width follows the text. */
  let { id, value, digits, unit, step, onchange, title }: {
    id: string;
    value: number;
    digits: number;
    unit: string;
    step: number;
    onchange: (v: number) => void;
    title: string;
  } = $props();

  let draft = $state<string | null>(null);
  const text = $derived(draft ?? value.toFixed(digits));

  function commit() {
    if (draft === null) return;
    const v = parseFloat(draft.replace(',', '.'));
    draft = null;
    if (Number.isFinite(v)) onchange(v);
  }
  function keydown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') { draft = null; e.currentTarget.blur(); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      draft = null;
      onchange(value + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1));
    }
  }
</script>

<div class="field">
  <input {id} {title} type="text" inputmode="decimal" autocomplete="off" spellcheck="false" style:--len={text.length} value={text} oninput={(e) => (draft = e.currentTarget.value)} onblur={commit} onkeydown={keydown} />
  <span>{unit}</span>
</div>

<style>
  .field { display: flex; align-items: baseline; gap: 8px; }
  input { font: 500 24px/1.2 var(--mono); font-variant-numeric: tabular-nums; color: var(--ink); background: transparent; border: 0; border-bottom: 1px solid var(--rule); border-radius: 0; margin: 0; padding: 0 2px 2px; width: calc(var(--len) * 1ch + 6px); }
  input:hover { border-bottom-color: var(--ink-3); }
  input:focus-visible { outline: none; border-bottom-color: var(--focus); }
  span { color: var(--ink-2); }
</style>

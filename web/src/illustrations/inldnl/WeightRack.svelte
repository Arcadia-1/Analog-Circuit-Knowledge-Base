<script lang="ts">
  import { nf } from '../../lib/format';

  /** One vertical slider per binary weight: drag a capacitor off its nominal value and watch its own carry move. */
  let { trim, n, onchange }: { trim: number[]; n: number; onchange: (j: number, error: number) => void } = $props();

  const LIMIT = 2;
  const weight = (j: number) => 2 ** (n - 1 - j);
  const short = (w: number) => (w >= 1000 ? `${w / 1000}k` : String(w));
</script>

<div class="rack" role="group" aria-label="Capacitor weight errors">
  {#each { length: n } as _, j (j)}
    {@const err = trim[j] * 100}
    <label class="col" title="weight {weight(j)} LSB, {err >= 0 ? '+' : '−'}{nf(Math.abs(err), 2)} % = {err >= 0 ? '+' : '−'}{nf(Math.abs(trim[j] * weight(j)), 2)} LSB">
      <span class="err" class:off={Math.abs(err) > 0.005}>{err >= 0 ? '+' : '−'}{nf(Math.abs(err), 1)}</span>
      <input
        type="range"
        min={-LIMIT}
        max={LIMIT}
        step={0.05}
        value={err}
        aria-label="Error of weight {weight(j)} in percent"
        oninput={(e) => onchange(j, parseFloat(e.currentTarget.value) / 100)}
      />
      <span class="w">{short(weight(j))}</span>
    </label>
  {/each}
</div>

<style>
  .rack { display: flex; align-items: flex-end; gap: 2px; }
  .col { display: grid; justify-items: center; gap: 1px; cursor: ns-resize; }
  .err { font: 10px var(--mono); color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .err.off { color: var(--s2); }
  .w { font: 10px var(--mono); color: var(--ink-2); }
  input { writing-mode: vertical-lr; direction: rtl; width: 16px; height: 52px; margin: 0; accent-color: var(--s2); cursor: ns-resize; }
</style>

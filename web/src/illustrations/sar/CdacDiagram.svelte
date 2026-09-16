<script lang="ts">
  import type { Trial } from './model';

  /**
   * Capacitor DAC as a row of capacitors, one per weight, heights on a log scale. Comparison j switches capacitor j up;
   * it stays up when the input is not lower (bit 1) and drops back otherwise. Capacitors not yet tried are outlined.
   * The half unit at the end is the switched half of the terminating capacitor, which never moves.
   */
  let { weights, trace, shown, series, label }: { weights: number[]; trace: Trial[]; shown: number; series: 1 | 2; label: string } = $props();

  const slot = $derived(Math.min(34, 388 / (weights.length + 1)));
  const maxLog = $derived(Math.log2(2 * weights[0]));
  const h = (w: number) => 6 + (Math.log2(2 * w) / maxLog) * 26;
  // full value when it fits the slot (about 5.8 px per character), otherwise thousands
  const text = (w: number) => (String(w).length * 5.8 <= slot - 3 ? String(w) : `${Math.round(w / 1e3)}k`);
  const lastBit = $derived(shown > 0 ? trace[Math.min(shown, trace.length) - 1].bit : null);
  const xTerm = $derived(28 + weights.length * slot + slot / 2 + 2);
</script>

<svg viewBox="0 0 470 78" preserveAspectRatio="xMinYMid meet" role="img" aria-label={label}>
  <line class="plate" x1="20" y1="10" x2="436" y2="10" />
  <text class="m" x="0" y="10">V<tspan font-size="9" dy="3">x</tspan></text>
  <polygon class="cmp" points="436,1 436,19 452,10" />
  <text class="bit mono" x="458" y="10">{lastBit ?? '·'}</text>
  {#each weights as w, j (j)}
    {@const x = 28 + j * slot + slot / 2 - 2}
    {@const st = j < shown ? (trace[j].bit ? 'up' : 'down') : 'idle'}
    <line class="wire" x1={x} y1="10" x2={x} y2="16" />
    <rect class="cell {st} s{series}" class:active={j === shown - 1} x={x - slot / 2 + 2} y="16" width={slot - 4} height={h(w)} rx="2" />
    {#if st === 'up'}<path class="arrow s{series}" d="M{x},58 l-3,4 h6 z" />{/if}
    {#if st === 'down'}<path class="arrow s{series}" d="M{x},62 l-3,-4 h6 z" />{/if}
    {#if st === 'idle'}<circle class="rest" cx={x} cy="60" r="1.6" />{/if}
    <text class="tx s" x={x} y="74" text-anchor="middle">{text(w)}</text>
  {/each}
  <line class="wire" x1={xTerm} y1="10" x2={xTerm} y2="16" />
  <rect class="cell term" x={xTerm - slot / 2 + 2} y="16" width={slot - 4} height={h(0.5)} rx="2" />
  <line class="wire" x1={xTerm - 4} y1="60" x2={xTerm + 4} y2="60" />
  <text class="tx s" x={xTerm} y="74" text-anchor="middle">½</text>
</svg>

<style>
  svg { display: block; width: 100%; height: auto; aspect-ratio: 470 / 78; max-height: 78px; overflow: visible; }
  .plate { stroke: var(--ink-2); stroke-width: 1.5; }
  .wire { stroke: var(--ink-3); stroke-width: 1; }
  .cmp { fill: var(--plot); stroke: var(--ink-2); stroke-width: 1.25; }
  .bit { fill: var(--ink); font-size: 12px; dominant-baseline: central; }
  .m { fill: var(--ink-2); font: italic 13px var(--math); dominant-baseline: central; }
  .cell { stroke-width: 1.25; }
  .cell.idle { fill: var(--plot); stroke: var(--ink-3); }
  .cell.term { fill: var(--chip); stroke: var(--ink-3); stroke-dasharray: 2 1.6; }
  .cell.up.s1 { fill: var(--s1); stroke: var(--s1); } .cell.up.s2 { fill: var(--s2); stroke: var(--s2); }
  .cell.down.s1 { fill: var(--s1-soft); stroke: var(--s1); } .cell.down.s2 { fill: var(--s2-soft); stroke: var(--s2); }
  .cell.active { stroke: var(--ink); stroke-width: 1.75; }
  .arrow.s1 { fill: var(--s1); } .arrow.s2 { fill: var(--s2); }
  .rest { fill: var(--ink-3); }
  .s { font-size: 9.5px; }
</style>

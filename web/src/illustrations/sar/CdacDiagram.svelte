<script lang="ts">
  import type { Step } from './model';

  /**
   * Capacitor DAC as a row of capacitors, one per move, drawn to scale on a log axis.
   * After comparison k the capacitor of move k switches its bottom plate to Vref (decision 1) or ground (0);
   * capacitors not yet used sit at mid-scale.
   */
  let { moves, steps, shown, series, label }: { moves: number[]; steps: Step[]; shown: number; series: 1 | 2; label: string } = $props();

  const K = $derived(moves.length);
  const slot = $derived(Math.min(34, 388 / K));
  const maxLog = $derived(Math.log2(2 * Math.max(...moves)));
  const h = (s: number) => 6 + (Math.log2(2 * s) / maxLog) * 26;
  const lastBit = $derived(shown > 0 ? steps[Math.min(shown, steps.length) - 1].b : null);
</script>

<svg viewBox="0 0 470 78" preserveAspectRatio="xMinYMid meet" role="img" aria-label={label}>
  <line class="plate" x1="20" y1="10" x2="436" y2="10" />
  <text class="m" x="0" y="10">V<tspan font-size="9" dy="3">x</tspan></text>
  <polygon class="cmp" points="436,1 436,19 452,10" />
  <text class="bit mono" x="458" y="10">{lastBit ?? '·'}</text>
  {#each moves as s, i (i)}
    {@const x = 28 + i * slot}
    {@const st = i < shown && i < steps.length - 1 ? (steps[i].b ? 'up' : 'down') : 'idle'}
    <line class="wire" x1={x + slot / 2 - 2} y1="10" x2={x + slot / 2 - 2} y2="16" />
    <rect class="cell {st} s{series}" class:active={i === shown - 1} x={x} y="16" width={slot - 4} height={h(s)} rx="2" />
    {#if st === 'up'}<path class="arrow s{series}" d="M{x + slot / 2 - 2},{58} l-3,4 h6 z" />{/if}
    {#if st === 'down'}<path class="arrow s{series}" d="M{x + slot / 2 - 2},{62} l-3,-4 h6 z" />{/if}
    {#if st === 'idle'}<circle class="rest" cx={x + slot / 2 - 2} cy="60" r="1.6" />{/if}
    <text class="tx s" x={x + slot / 2 - 2} y="74" text-anchor="middle">{s}</text>
  {/each}
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
  .cell.up.s1 { fill: var(--s1); stroke: var(--s1); } .cell.up.s2 { fill: var(--s2); stroke: var(--s2); }
  .cell.down.s1 { fill: var(--s1-soft); stroke: var(--s1); } .cell.down.s2 { fill: var(--s2-soft); stroke: var(--s2); }
  .cell.active { stroke: var(--ink); stroke-width: 1.75; }
  .arrow.s1 { fill: var(--s1); } .arrow.s2 { fill: var(--s2); }
  .rest { fill: var(--ink-3); }
  .s { font-size: 9.5px; }
</style>

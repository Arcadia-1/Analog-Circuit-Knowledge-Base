<script lang="ts">
  import type { Snippet } from 'svelte';
  import Range from '../../components/ui/Range.svelte';
  import BodeChart from './BodeChart.svelte';
  import { constrainedAmplifier, frequency, response, type Constraint } from './model';
  let { id, title, a0Db = $bindable(60), betaDial = $bindable(2.01), bandwidth, constraint, low, high, probe = $bindable(0.5), intro }: {
    id: string; title: string; a0Db: number; betaDial: number; bandwidth: number; constraint: Constraint; low: number; high: number; probe: number; intro?: Snippet;
  } = $props();
  // The first detent is exact zero; the remaining track is logarithmic from 0.001 to 1.
  const beta = $derived(betaDial === 0 ? 0 : 10 ** (betaDial - 3.01));
  const m = $derived(constrainedAmplifier(a0Db, beta, bandwidth, constraint));
  const probeFrequency = $derived(10 ** (low + probe * (high - low)));
  const at = $derived(response(m, probeFrequency));
</script>

<section class="case" aria-label={title}>
  <aside class="control-panel">
    {@render intro?.()}
    <div class="case-title"><h2>{title}</h2><span>GBW <b>{frequency(m.gbw, 4)}</b></span></div>
    <div class="controls">
      <Range id="{id}-a0" bind:value={a0Db} min={20} max={100} step={1} output="{a0Db} dB">Open-loop gain <var>A</var><sub>0</sub></Range>
      <Range id="{id}-beta" bind:value={betaDial} min={0} max={3.01} step={0.01} output={beta === 0 ? '0' : String(Number(beta.toPrecision(4)))}>Feedback factor <var>β</var></Range>
    </div>
    <dl class="metrics">
      <div><dt>Open-loop BW</dt><dd class="mono blue">{frequency(m.pole, 4)}</dd></div>
      <div><dt>Closed-loop BW</dt><dd class="mono amber">{frequency(m.closedBw, 4)}</dd></div>
      <div><dt title="Actual DC gain T₀ = A₀ / (1 + βA₀); the ideal is 1/β.">DC gain <span>T₀</span></dt><dd class="mono">{Number(m.closedDc.toPrecision(4))} <small>V/V</small></dd></div>
      <div><dt title={beta === 0 ? 'No ideal feedback gain exists when β = 0.' : 'Relative to ideal gain 1/β: error = 1 / (1 + βA₀).'}>DC gain error</dt><dd class="mono">{beta === 0 ? 'n/a' : (m.relativeError * 100).toFixed(3)}{#if beta !== 0}<small>%</small>{/if}</dd></div>
    </dl>
    <div class="probe-readout" aria-label="Response at {frequency(probeFrequency, 4)}">
      <span><small>Frequency</small><b>{frequency(probeFrequency, 4)}</b></span>
      <span class="blue"><small>Open-loop gain A</small><b>{at.openDb.toFixed(1)} dB</b></span>
      <span class="green"><small>Loop gain L = βA</small><b>{beta === 0 ? 'L = 0' : `${at.loopDb.toFixed(1)} dB`}</b></span>
      <span class="amber"><small>Closed-loop gain T</small><b>{at.closedDb.toFixed(1)} dB</b></span>
      <span class="amber"><small>Closed-loop phase ∠T</small><b>{at.closedPhase.toFixed(1)}°</b></span>
    </div>
  </aside>
  <div class="chart-panel">
    <BodeChart model={m} {id} {low} {high} bind:probe />
  </div>
</section>

<style>
  .case { min-width: 0; min-height: 0; height: 100%; display: grid; grid-template-columns: minmax(330px, 420px) minmax(0, 1fr); gap: 26px; }
  .control-panel { min-width: 0; min-height: 0; display: grid; align-content: start; gap: 10px; padding-right: 22px; border-right: 1px solid var(--rule); }
  .chart-panel { min-width: 0; min-height: 0; display: flex; }
  .chart-panel :global(.bode) { flex: 1; }
  .case-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  h2 { font-size: 16px; font-weight: 550; margin: 0; }
  .case-title span { font-size: 11px; color: var(--ink-3); }
  .case-title b { display: inline-block; color: var(--ink-2); text-align: right; }
  .controls { padding: 10px 12px; background: var(--chip); border-radius: 5px; display: grid; gap: 10px; }
  .controls :global(.range) { display: grid; grid-template-columns: minmax(0, 1fr) 8ch; gap: 4px 10px; width: 100%; }
  .controls :global(input) { grid-column: 1 / -1; width: 100%; min-width: 0; }
  .controls :global(output) { width: 8ch; text-align: right; font-size: 12px; }
  .controls :global(label) { letter-spacing: .025em; font-size: 10px; }
  .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; gap: 10px 16px; padding: 1px 2px; }
  dt { font-size: 10px; color: var(--ink-2); white-space: nowrap; }
  dd { margin: 1px 0 0; font-size: 14px; white-space: nowrap; }
  small { font-size: 10px; color: var(--ink-3); }
  .blue { color: var(--s1); }
  .amber { color: var(--s2); }
  .green { color: var(--brand); }
  .probe-readout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; padding: 10px 2px 0; border-top: 1px solid var(--rule); font-size: 11px; }
  .probe-readout span:first-child { grid-column: 1 / -1; }
  .probe-readout span { display: grid; gap: 1px; }
  .probe-readout small { color: currentColor; opacity: .72; font: 9px var(--sans); white-space: nowrap; }
  b { font: 11px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  @media (min-width: 821px) and (max-height: 740px) {
    .control-panel { gap: 5px; }
    .controls { padding: 6px 8px; gap: 4px; }
    .controls :global(.range) { grid-template-columns: 126px minmax(40px, 1fr) 7ch; gap: 8px; }
    .controls :global(input) { grid-column: auto; }
    .controls :global(output) { width: 7ch; }
    .metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 0; }
    dt { overflow: hidden; text-overflow: ellipsis; font-size: 9px; }
    dd { font-size: 11px; }
    .probe-readout { grid-template-columns: 1.05fr repeat(4, minmax(0, 1fr)); gap: 2px; padding: 4px 0 0; }
    .probe-readout span:first-child { grid-column: auto; }
    .probe-readout small { overflow: hidden; text-overflow: ellipsis; font-size: 8px; }
    .probe-readout b { font-size: 10px; }
  }
  @media (max-width: 820px) {
    .case { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 6px; }
    .control-panel { gap: 5px; padding: 0 0 6px; border-right: 0; border-bottom: 1px solid var(--rule); }
    .controls { padding: 6px 8px; gap: 4px; }
    .controls :global(.range) { grid-template-columns: 126px minmax(40px, 1fr) 7ch; gap: 8px; }
    .controls :global(input) { grid-column: auto; }
    .controls :global(output) { width: 7ch; }
    .metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 0; }
    dt { font-size: 9px; }
    dd { font-size: 11px; }
    small { font-size: 9px; }
    .probe-readout { grid-template-columns: 1.05fr repeat(4, minmax(0, 1fr)); padding: 4px 0 0; font-size: 10px; gap: 2px; }
    .probe-readout span:first-child { grid-column: auto; }
    .probe-readout small { font-size: 8px; overflow: hidden; text-overflow: ellipsis; }
    .probe-readout b { font-size: 10px; }
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Range from '../../components/ui/Range.svelte';
  import BodeChart from './BodeChart.svelte';
  import { constrainedAmplifier, frequency, response, type Constraint } from './model';
  let { id, a0Db = $bindable(60), betaDial = $bindable(2.01), bandwidth, constraint, low, high, probe = $bindable(0.5), intro, hold, bandwidthControl, modeNote }: {
    id: string; a0Db: number; betaDial: number; bandwidth: number; constraint: Constraint; low: number; high: number; probe: number;
    intro?: Snippet; hold?: Snippet; bandwidthControl?: Snippet; modeNote?: Snippet;
  } = $props();
  // The first detent is exact zero; the remaining track is logarithmic from 0.001 to 1.
  const beta = $derived(betaDial === 0 ? 0 : 10 ** (betaDial - 3.01));
  const m = $derived(constrainedAmplifier(a0Db, beta, bandwidth, constraint));
  const probeFrequency = $derived(10 ** (low + probe * (high - low)));
  const at = $derived(response(m, probeFrequency));
</script>

<section class="case" aria-label="Single-pole negative-feedback amplifier">
  <aside class="control-panel">
    {@render intro?.()}
    <div class="control-heading"><h2>Model controls</h2><span>GBW <b>{frequency(m.gbw, 4)}</b></span></div>
    <div class="tuning-panel">
      {@render hold?.()}
      <div class="controls">
        <Range id="{id}-a0" bind:value={a0Db} min={20} max={100} step={1} output="{a0Db} dB">Open-loop gain <var>A</var><sub>0</sub></Range>
        <Range id="{id}-beta" bind:value={betaDial} min={0} max={3.01} step={0.01} output={beta === 0 ? '0' : String(Number(beta.toPrecision(4)))}>Feedback factor <var>β</var></Range>
        {@render bandwidthControl?.()}
      </div>
      {@render modeNote?.()}
    </div>
    <div class="readout-columns">
      <section class="readout-group" aria-label="Overall model values">
        <h3>Model</h3>
        <dl class="readout-list">
          <div><dt>Open-loop BW</dt><dd class="blue">{frequency(m.pole, 4)}</dd></div>
          <div><dt>Closed-loop BW</dt><dd class="amber">{frequency(m.closedBw, 4)}</dd></div>
          <div><dt title="Actual DC gain T₀ = A₀ / (1 + βA₀); the ideal is 1/β.">DC gain <span>T₀</span></dt><dd>{Number(m.closedDc.toPrecision(4))} <small>V/V</small></dd></div>
          <div><dt title={beta === 0 ? 'No ideal feedback gain exists when β = 0.' : 'Relative to ideal gain 1/β: error = 1 / (1 + βA₀).'}>DC gain error</dt><dd>{beta === 0 ? 'n/a' : (m.relativeError * 100).toFixed(3)}{#if beta !== 0}<small>%</small>{/if}</dd></div>
        </dl>
      </section>
      <section class="readout-group" aria-label="Response at the plot cursor">
        <h3>At cursor</h3>
        <dl class="readout-list">
          <div><dt>Frequency</dt><dd>{frequency(probeFrequency, 4)}</dd></div>
          <div class="blue"><dt>Open-loop gain A</dt><dd>{at.openDb.toFixed(1)} dB</dd></div>
          <div class="green"><dt>Loop gain L = βA</dt><dd>{beta === 0 ? '0' : `${at.loopDb.toFixed(1)} dB`}</dd></div>
          <div class="amber"><dt>Closed-loop gain T</dt><dd>{at.closedDb.toFixed(1)} dB</dd></div>
          <div class="amber"><dt>Closed-loop phase ∠T</dt><dd>{at.closedPhase.toFixed(1)}°</dd></div>
        </dl>
      </section>
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
  .control-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  h2 { font-size: 16px; font-weight: 550; margin: 0; }
  .control-heading span { font-size: 11px; color: var(--ink-3); }
  .control-heading b { display: inline-block; color: var(--ink-2); text-align: right; }
  .tuning-panel { min-width: 0; padding: 10px 12px; background: var(--chip); border-radius: 5px; display: grid; gap: 10px; }
  .controls { min-width: 0; display: grid; gap: 10px; padding-top: 9px; border-top: 1px solid var(--rule-soft); }
  .controls :global(.range) { display: grid; grid-template-columns: minmax(0, 1fr) 8ch; gap: 4px 10px; width: 100%; }
  .controls :global(input) { grid-column: 1 / -1; width: 100%; min-width: 0; }
  .controls :global(output) { width: 8ch; text-align: right; font-size: 12px; }
  .controls :global(label) { letter-spacing: .025em; font-size: 10px; }
  .readout-columns { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; padding: 2px; }
  .readout-group { min-width: 0; }
  h3 { margin: 0 0 7px; color: var(--ink-3); font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  .readout-list { display: grid; gap: 6px; margin: 0; }
  .readout-list > div { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 7px; }
  dt { min-width: 0; overflow: hidden; color: var(--ink-2); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .readout-list .blue dt, .readout-list .amber dt, .readout-list .green dt { color: currentColor; opacity: .76; }
  dd { margin: 0; font: 12px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  small { font-size: 9px; color: var(--ink-3); }
  .blue { color: var(--s1); }
  .amber { color: var(--s2); }
  .green { color: var(--brand); }
  b { font: 11px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  @media (min-width: 821px) and (max-height: 740px) {
    .control-panel { gap: 5px; }
    .tuning-panel { padding: 6px 8px; gap: 4px; }
    .controls { gap: 4px; padding-top: 5px; }
    .controls :global(.range) { grid-template-columns: 126px minmax(40px, 1fr) 7ch; gap: 8px; }
    .controls :global(input) { grid-column: auto; }
    .controls :global(output) { width: 7ch; }
    .readout-columns { gap: 12px; padding: 0; }
    h3 { margin-bottom: 4px; font-size: 9px; }
    .readout-list { gap: 3px; }
    dt { font-size: 9px; }
    dd { font-size: 10px; }
  }
  @media (max-width: 820px) {
    .case { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 6px; }
    .control-panel { gap: 5px; padding: 0 0 6px; border-right: 0; border-bottom: 1px solid var(--rule); }
    .tuning-panel { padding: 6px 8px; gap: 4px; }
    .controls { gap: 4px; padding-top: 5px; }
    .controls :global(.range) { grid-template-columns: 126px minmax(40px, 1fr) 7ch; gap: 8px; }
    .controls :global(input) { grid-column: auto; }
    .controls :global(output) { width: 7ch; }
    .readout-columns { gap: 12px; padding: 0; }
    h3 { margin-bottom: 4px; font-size: 9px; }
    .readout-list { gap: 3px; }
    dt { font-size: 9px; }
    dd { font-size: 10px; }
    small { font-size: 8px; }
  }
  @media (max-width: 520px) {
    .controls :global(.range) { grid-template-columns: 118px minmax(32px, 1fr) 6.5ch; gap: 6px; }
    .controls :global(output) { width: 6.5ch; }
    .readout-columns { gap: 10px; }
    .readout-list > div { display: block; }
    dd { margin-top: 1px; }
  }
</style>

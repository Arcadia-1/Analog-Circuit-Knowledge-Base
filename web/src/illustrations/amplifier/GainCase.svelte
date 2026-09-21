<script lang="ts">
  import Range from '../../components/ui/Range.svelte';
  import BodeChart from './BodeChart.svelte';
  import { constrainedAmplifier, frequency, response, type Constraint } from './model';
  let { id, title, a0Db = $bindable(60), betaLog = $bindable(-1), bandwidth, constraint, low, high, probe = $bindable(0.5) }: {
    id: string; title: string; a0Db: number; betaLog: number; bandwidth: number; constraint: Constraint; low: number; high: number; probe: number;
  } = $props();
  const beta = $derived(10 ** betaLog);
  const m = $derived(constrainedAmplifier(a0Db, beta, bandwidth, constraint));
  const probeFrequency = $derived(10 ** (low + probe * (high - low)));
  const at = $derived(response(m, probeFrequency));
</script>

<section class="case" aria-label={title}>
  <div class="case-title"><h2>{title}</h2><span>GBW <b>{frequency(m.gbw, 4)}</b></span></div>
  <div class="controls">
    <Range id="{id}-a0" bind:value={a0Db} min={20} max={100} step={1} output="{a0Db} dB">Open-loop gain <var>A</var><sub>0</sub></Range>
    <Range id="{id}-beta" bind:value={betaLog} min={-3} max={0} step={0.02} output={String(Number(beta.toPrecision(4)))}>Feedback <var>β</var></Range>
  </div>
  <dl class="metrics">
    <div><dt>Open-loop BW</dt><dd class="mono blue">{frequency(m.pole, 4)}</dd></div>
    <div><dt>Closed-loop BW</dt><dd class="mono amber">{frequency(m.closedBw, 4)}</dd></div>
    <div><dt title="Actual DC gain T₀ = A₀ / (1 + βA₀); the ideal is 1/β.">DC gain <span>T₀</span></dt><dd class="mono">{Number(m.closedDc.toPrecision(4))} <small>V/V</small></dd></div>
    <div><dt title="Relative to ideal gain 1/β: error = 1 / (1 + βA₀).">DC gain error</dt><dd class="mono">{(m.relativeError * 100).toFixed(3)}<small>%</small></dd></div>
  </dl>
  <BodeChart model={m} {id} {low} {high} bind:probe />
  <div class="probe-readout" aria-label="Response at {frequency(probeFrequency, 4)}">
    <span><small>Frequency</small><b>{frequency(probeFrequency, 4)}</b></span>
    <span class="blue"><small>Open-loop gain A</small><b>{at.openDb.toFixed(1)} dB</b></span>
    <span class="green"><small>Loop gain L = βA</small><b>{at.loopDb.toFixed(1)} dB</b></span>
    <span class="amber"><small>Closed-loop gain T</small><b>{at.closedDb.toFixed(1)} dB</b></span>
    <span class="amber"><small>Closed-loop phase ∠T</small><b>{at.closedPhase.toFixed(1)}°</b></span>
  </div>
</section>

<style>
  .case { min-width: 0; min-height: 0; height: 100%; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; gap: 7px; }
  .case-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  h2 { font-size: 15px; font-weight: 500; margin: 0; }
  .case-title span { font-size: 11px; color: var(--ink-3); }
  .case-title b { display: inline-block; width: 12ch; color: var(--ink-2); text-align: right; }
  .controls { padding: 7px 10px; background: var(--chip); border-radius: 5px; display: grid; gap: 6px; }
  .controls :global(.range) { display: grid; grid-template-columns: 145px minmax(40px, 1fr) 8ch; gap: 10px; width: 100%; }
  .controls :global(input) { width: 100%; min-width: 0; }
  .controls :global(output) { width: 8ch; text-align: right; font-size: 12px; }
  .controls :global(label) { letter-spacing: .025em; font-size: 10px; }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; gap: 8px; }
  dt { font-size: 10px; color: var(--ink-2); white-space: nowrap; }
  dd { margin: 1px 0 0; font-size: clamp(12px, 1.1vw, 15px); white-space: nowrap; }
  small { font-size: 10px; color: var(--ink-3); }
  .blue { color: var(--s1); }
  .amber { color: var(--s2); }
  .green { color: var(--brand); }
  .probe-readout { display: grid; grid-template-columns: 1.05fr repeat(4, minmax(0, 1fr)); padding: 5px 0 0; border-top: 1px solid var(--rule); font-size: 11px; }
  .probe-readout span { display: grid; gap: 1px; }
  .probe-readout small { color: currentColor; opacity: .72; font: 9px var(--sans); white-space: nowrap; }
  b { font: 11px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  @media (max-width: 600px) {
    .case { gap: 5px; }
    .controls { padding: 6px 8px; gap: 4px; }
    .controls :global(.range) { grid-template-columns: 126px minmax(40px, 1fr) 7ch; gap: 8px; }
    .controls :global(output) { width: 7ch; }
    .metrics { gap: 4px; }
    dt { font-size: 9px; }
    dd { font-size: 11px; }
    small { font-size: 9px; }
    .probe-readout { font-size: 10px; gap: 2px; }
    .probe-readout small { font-size: 8px; overflow: hidden; text-overflow: ellipsis; }
    .probe-readout b { font-size: 10px; }
  }
</style>

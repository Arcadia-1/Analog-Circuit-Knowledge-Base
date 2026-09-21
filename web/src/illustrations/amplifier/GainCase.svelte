<script lang="ts">
  import Range from '../../components/ui/Range.svelte';
  import BodeChart from './BodeChart.svelte';
  import { amplifier, frequency, response } from './model';
  let { id, title, a0Db = $bindable(60), gbw, gainDb, probe = $bindable(-1) }: {
    id: string; title: string; a0Db: number; gbw: number; gainDb: number; probe: number;
  } = $props();
  const m = $derived(amplifier(a0Db, gbw, gainDb));
  const at = $derived(response(m, gbw * 10 ** probe));
</script>

<section class="case" aria-label={title}>
  <div class="case-title"><h2>{title}</h2><span>Same GBW · same β</span></div>
  <div class="gain-control"><Range id="{id}-a0" bind:value={a0Db} min={20} max={100} step={1} output="{a0Db} dB"><var>A</var><sub>0</sub> · open-loop DC</Range></div>
  <dl class="metrics">
    <div><dt>Open-loop BW <span>fOL</span></dt><dd class="mono blue">{frequency(m.pole)}</dd></div>
    <div><dt>Closed-loop BW <span>fCL</span></dt><dd class="mono amber">{frequency(m.closedBw)}</dd></div>
    <div><dt>DC gain <span>T₀</span></dt><dd class="mono">{Number(m.closedDc.toPrecision(5))} <small>V/V</small></dd></div>
    <div><dt>DC gain error</dt><dd class="mono">{(m.relativeError * 100).toFixed(3)}<small>%</small></dd></div>
  </dl>
  <BodeChart model={m} {id} bind:probe />
  <div class="probe-readout" aria-label="Response at the shared frequency probe">
    <span class="blue">A <b>{at.openDb.toFixed(2)} dB</b></span>
    <span class="amber">T <b>{at.closedDb.toFixed(2)} dB</b></span>
    <span class="amber">∠T <b>{at.closedPhase.toFixed(1)}°</b></span>
  </div>
  <div class="crossovers">
    <span>A = 1: <b>{m.unity === null ? 'none' : frequency(m.unity)}</b></span>
    <span>L = 1: <b>{m.crossover === null ? 'no crossing' : frequency(m.crossover)}</b></span>
  </div>
</section>

<style>
  .case { min-width: 0; }
  .case-title { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  h2 { font-size: 17px; font-weight: 500; margin: 0; }
  .case-title span { font-size: 11px; color: var(--ink-3); }
  .gain-control { padding: 10px 12px; background: var(--chip); border-radius: 5px; }
  .gain-control :global(.range) { display: grid; grid-template-columns: 140px minmax(50px, 1fr) 7ch; width: 100%; }
  .gain-control :global(input) { width: 100%; min-width: 0; }
  .gain-control :global(output) { width: 7ch; text-align: right; }
  .gain-control :global(label) { letter-spacing: .035em; font-size: 10px; }
  .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 13px 0 12px; gap: 8px; }
  dt { font-size: 11px; color: var(--ink-2); white-space: nowrap; }
  dt span { color: var(--ink-3); }
  dd { margin: 3px 0 0; font-size: clamp(12px, 1.13vw, 16px); white-space: nowrap; }
  small { font-size: 11px; color: var(--ink-3); }
  .blue { color: var(--s1); }
  .amber { color: var(--s2); }
  .probe-readout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 8px 0; border-bottom: 1px solid var(--rule); font-size: 11px; }
  .probe-readout span { display: flex; gap: 6px; align-items: baseline; }
  b { font: 11px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .crossovers { display: flex; justify-content: space-between; gap: 8px; font-size: 10px; color: var(--ink-3); margin-top: 6px; }
  .crossovers b { font-size: 10px; }
  @media (max-width: 1100px) and (min-width: 901px) { dt span { display: none; } }
  @media (max-width: 600px) {
    .metrics { grid-template-columns: 1fr 1fr; row-gap: 9px; }
    dd { font-size: 15px; }
    .probe-readout span { flex-direction: column; gap: 2px; }
    .crossovers { flex-wrap: wrap; min-height: 35px; align-content: start; }
    .gain-control :global(.range) { grid-template-columns: 120px minmax(40px, 1fr) 6ch; }
  }
</style>

<script lang="ts">
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import GainCase from './GainCase.svelte';
  import { frequency, type Constraint } from './model';

  let leftDb = $state(60), rightDb = $state(60);
  let leftBeta = $state(-2), rightBeta = $state(-1);
  let constraint = $state<Constraint>('open-loop');
  let openBwLog = $state(2), closedBwLog = $state(4), probe = $state(0.5);
  let activeCase = $state(1);
  const bandwidthLog = $derived(constraint === 'open-loop' ? openBwLog : closedBwLog);
  const bandwidth = $derived(10 ** bandwidthLog);
  // Frequency axes are shared and stay fixed while either A0 or beta changes.
  const low = $derived(bandwidthLog + (constraint === 'open-loop' ? -2 : -6));
  const high = $derived(bandwidthLog + (constraint === 'open-loop' ? 6 : 4));
</script>

<main class="page amplifier-page">
  <div class="setup">
    <div class="feedback">
      <svg viewBox="0 0 420 106" role="img" aria-label="Negative feedback: input minus beta times output drives amplifier A(s). Closed-loop gain T equals A divided by one plus beta A.">
        <g class="wire"><path d="M12 30H74 M106 30H150 M246 30H397 M302 30V83H244 M184 83H90V46" /><path d="m65 26 9 4-9 4 m76-8 9 4-9 4 m238-8 9 4-9 4 M253 79l-9 4 9 4 M86 55l4-9 4 9" /></g>
        <circle class="block" cx="90" cy="30" r="16" /><rect class="block forward" x="150" y="10" width="96" height="40" rx="4" /><rect class="block feedback-block" x="184" y="67" width="60" height="32" rx="4" />
        <text x="87" y="34" class="diagram-math">Σ</text><text x="73" y="14" class="sign">+</text><text x="101" y="56" class="sign">−</text>
        <text x="198" y="36" text-anchor="middle" class="diagram-math blue">A(s)</text><text x="214" y="88" text-anchor="middle" class="diagram-math green">β</text>
        <text x="12" y="17" class="diagram-label">Vin</text><text x="358" y="17" class="diagram-label">Vout</text><circle cx="302" cy="30" r="3" fill="var(--ink-3)" />
      </svg>
      <div class="equation"><var>T</var> = <span class="fraction"><span><var>A</var></span><span>1 + <var>βA</var></span></span><span class="equation-caption">single-pole · small signal</span></div>
    </div>
    <div class="design-controls">
      <div class="constraint-row"><span class="label">Hold</span><Segmented label="Bandwidth constraint" size="sm" options={[{ value: 'open-loop', label: 'Open loop · A₀ & fOL' }, { value: 'closed-loop', label: 'Closed-loop BW · fCL' }]} bind:value={constraint} /></div>
      <div class="bandwidth-control">
        {#if constraint === 'open-loop'}
          <Range id="amp-bandwidth" bind:value={openBwLog} min={0} max={6} step={0.05} output={frequency(bandwidth, 4)}>Open-loop BW <var>f</var><sub>OL</sub></Range>
        {:else}
          <Range id="amp-bandwidth" bind:value={closedBwLog} min={1} max={8} step={0.05} output={frequency(bandwidth, 4)}>Closed-loop BW <var>f</var><sub>CL</sub></Range>
        {/if}
      </div>
      <p class="mode-note">{constraint === 'open-loop' ? 'Tune β → fCL changes; A₀ and fOL stay fixed.' : 'Tune A₀ or β → required fOL / GBW change; fCL stays fixed.'}</p>
    </div>
  </div>

  <div class="legend-row" aria-label="Plot legend">
    <span class="legend-item"><i class="stroke blue-line"></i><span class="legend-name">Open loop</span> <var>A</var></span>
    <span class="legend-item"><i class="stroke loop-line"></i><span class="legend-name">Loop</span> <var>L = βA</var></span>
    <span class="legend-item"><i class="stroke amber-line"></i><span class="legend-name">Closed loop</span> <var>T</var></span>
    <span class="marker-key" title="Bandwidths are −3.0103 dB relative to each curve’s own DC gain. Hollow rings distinguish A = 1 from L = 1; the gray guide is ideal gain 1/β.">● −3 dB &nbsp; ○ Unity gain</span>
    <div class="case-switch"><Segmented label="Visible comparison case" size="sm" options={[{ value: 1, label: 'Case 1' }, { value: 2, label: 'Case 2' }]} bind:value={activeCase} /></div>
  </div>

  <div class="cases" class:show-second={activeCase === 2}>
    <GainCase id="case-1" title="Case 1" bind:a0Db={leftDb} bind:betaLog={leftBeta} {bandwidth} {constraint} {low} {high} bind:probe />
    <GainCase id="case-2" title="Case 2" bind:a0Db={rightDb} bind:betaLog={rightBeta} {bandwidth} {constraint} {low} {high} bind:probe />
  </div>

  <div class="bottom-row">
    <div class="probe-control"><Range id="amp-probe" bind:value={probe} min={0} max={1} step={0.001} output={frequency(10 ** (low + probe * (high - low)), 4)}>Probe frequency</Range></div>
    <span class="identity"><var>f</var><sub>CL</sub> = <var>f</var><sub>OL</sub>(1 + <var>βA</var><sub>0</sub>)</span>
  </div>
</main>

<style>
  /* This lesson fills the space between the existing header and real visitor footer. */
  :global(body:has(.amplifier-page)) { height: 100dvh; min-height: 0; }
  :global(body:has(.amplifier-page) > .site-header), :global(body:has(.amplifier-page) > .site-footer) { flex-shrink: 0; }
  :global(body:has(.amplifier-page) #main-content) { flex: 1 1 0; min-height: 0; display: flex; }
  :global(body:has(.amplifier-page) #main-content > astro-island) { display: flex; flex: 1; min-width: 0; min-height: 0; }
  :global(body:has(.amplifier-page) .site-footer .footer-inner) { padding-block: 9px; }
  .amplifier-page { width: 100%; height: 100%; min-height: 0; padding: 10px 24px 8px; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 8px; }
  .setup { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: center; border-bottom: 1px solid var(--rule); padding-bottom: 8px; }
  .feedback { display: flex; align-items: center; gap: 20px; min-width: 0; }
  .feedback svg { width: 65%; max-width: 330px; height: 74px; }
  .wire { stroke: var(--ink-3); fill: none; stroke-width: 1.2; }
  .block { fill: var(--plot); stroke: var(--ink-3); }
  .forward { stroke: var(--s1); }
  .feedback-block { stroke: var(--brand); }
  .diagram-math { fill: var(--ink); font: italic 20px var(--math); }
  .diagram-math.blue { fill: var(--s1); }
  .diagram-math.green { fill: var(--brand); }
  .diagram-label, .sign { fill: var(--ink-2); font: 12px var(--mono); }
  .equation { display: flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 5px; font: 21px var(--math); }
  .fraction { display: inline-grid; text-align: center; font-size: 18px; }
  .fraction > span:first-child { border-bottom: 1px solid var(--ink-3); }
  .fraction > span { padding: 0 5px; }
  .equation-caption { font: 10px var(--sans); color: var(--ink-3); flex-basis: 100%; text-align: center; }
  .design-controls { display: grid; gap: 6px; min-width: 0; }
  .constraint-row { display: flex; align-items: center; gap: 12px; }
  .constraint-row > .label { font-size: 10px; }
  .bandwidth-control :global(.range) { display: grid; grid-template-columns: 145px minmax(40px, 1fr) 11ch; gap: 10px; width: 100%; }
  .bandwidth-control :global(input) { width: 100%; min-width: 0; }
  .bandwidth-control :global(output) { width: 11ch; font-size: 12px; text-align: right; }
  .bandwidth-control :global(label) { font-size: 10px; letter-spacing: .025em; }
  .mode-note { margin: 0; color: var(--ink-3); font-size: 11px; line-height: 16px; height: 16px; }
  .legend-row { display: flex; align-items: center; gap: 20px; font-size: 11px; color: var(--ink-2); min-width: 0; }
  .legend-item { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
  .legend-item var { font-size: 15px; }
  .stroke { width: 21px; border-top: 2px solid; }
  .blue-line { color: var(--s1); }
  .amber-line { color: var(--s2); }
  .loop-line { color: var(--brand); border-top-style: dashed; }
  .marker-key { margin-left: auto; font-size: 10px; color: var(--ink-3); white-space: nowrap; }
  .case-switch { display: none; }
  .cases { display: grid; min-height: 0; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; }
  .bottom-row { display: flex; align-items: center; gap: 24px; border-top: 1px solid var(--rule); padding-top: 6px; }
  .probe-control { flex: 1; min-width: 0; }
  .probe-control :global(.range) { display: grid; grid-template-columns: 122px minmax(50px, 1fr) 12ch; gap: 10px; width: 100%; }
  .probe-control :global(input) { width: 100%; min-width: 0; }
  .probe-control :global(label) { font-size: 10px; letter-spacing: .04em; }
  .probe-control :global(output) { width: 12ch; font-size: 12px; }
  .identity { font: 17px var(--math); white-space: nowrap; }
  .identity sub { font-size: 10px; }
  @media (max-width: 900px) {
    .amplifier-page { padding: 8px 16px; gap: 7px; }
    .setup { gap: 12px; }
    .feedback { gap: 6px; }
    .feedback svg { width: 66%; height: 64px; }
    .equation { font-size: 18px; }
    .fraction { font-size: 16px; }
    .constraint-row { gap: 6px; }
    .constraint-row :global(.sm button) { font-size: 11px; }
    .bandwidth-control :global(.range) { grid-template-columns: 129px minmax(30px, 1fr) 10ch; gap: 6px; }
    .bandwidth-control :global(output) { width: 10ch; }
    .mode-note { font-size: 10px; }
    .cases { grid-template-columns: minmax(0, 1fr); }
    .cases:not(.show-second) :global(.case:nth-child(2)), .cases.show-second :global(.case:first-child) { display: none; }
    .case-switch { display: block; margin-left: auto; }
    .marker-key { display: none; }
    .legend-row { gap: 12px; }
    .identity { font-size: 15px; }
  }
  @media (max-width: 600px) {
    .setup { grid-template-columns: minmax(0, 1fr); padding-bottom: 6px; }
    .feedback { display: none; }
    .constraint-row :global(.sm button) { font-size: 11px; }
    .constraint-row :global(.seg) { flex: 1; }
    .design-controls { gap: 5px; }
    .legend-row { gap: 10px; }
    .legend-name { display: none; }
    .stroke { width: 16px; }
    .legend-item { gap: 4px; }
    .case-switch :global(.sm button) { font-size: 11px; padding: 5px 8px; }
    .bottom-row { gap: 0; }
    .identity { display: none; }
    .probe-control :global(.range) { grid-template-columns: 108px minmax(40px, 1fr) 10ch; gap: 8px; }
    .probe-control :global(output) { width: 10ch; }
    :global(body:has(.amplifier-page) .site-footer .footer-inner) { padding: 6px 16px; gap: 3px 12px; font-size: 10px; }
    :global(body:has(.amplifier-page) .site-footer .brand) { font-size: 11px; }
    :global(body:has(.amplifier-page) .site-footer nav) { width: auto; }
    :global(body:has(.amplifier-page) .site-footer .visitors) { font-size: 10px; }
  }
</style>

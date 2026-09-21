<script lang="ts">
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import GainCase from './GainCase.svelte';
  import { frequency, type Constraint } from './model';

  let a0Db = $state(60), betaDial = $state(2.01);
  let constraint = $state<Constraint>('open-loop');
  let openBwLog = $state(2), closedBwLog = $state(4), probe = $state(0.5);
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
      <div class="equation-stack">
        <div class="equation"><var>T</var> = <span class="fraction"><span><var>A</var></span><span>1 + <var>βA</var></span></span></div>
        <div class="bandwidth-equation"><var>f</var><sub>CL</sub> = <var>f</var><sub>OL</sub>(1 + <var>βA</var><sub>0</sub>)</div>
        <span class="equation-caption">single-pole · small signal</span>
      </div>
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
      <p class="mode-note"><span>{constraint === 'open-loop' ? 'Tune β → fCL changes; A₀ and fOL stay fixed.' : 'Tune A₀ or β → required fOL / GBW change; fCL stays fixed.'}</span><span class="relationship">β = 0 disconnects feedback: L = 0 and T = A.</span></p>
    </div>
  </div>

  <div class="response">
    <GainCase id="amplifier" title="Amplifier response" bind:a0Db bind:betaDial {bandwidth} {constraint} {low} {high} bind:probe />
  </div>

</main>

<style>
  /* This lesson fills the space between the existing header and real visitor footer. */
  :global(body:has(.amplifier-page)) { height: 100dvh; min-height: 0; }
  :global(body:has(.amplifier-page) > .site-header), :global(body:has(.amplifier-page) > .site-footer) { flex-shrink: 0; }
  :global(body:has(.amplifier-page) #main-content) { flex: 1 1 0; min-height: 0; display: flex; }
  :global(body:has(.amplifier-page) #main-content > astro-island) { display: flex; flex: 1; min-width: 0; min-height: 0; }
  :global(body:has(.amplifier-page) .site-footer .footer-inner) { padding-block: 9px; }
  .amplifier-page { width: 100%; height: 100%; min-height: 0; padding: 10px 24px 8px; grid-template-rows: auto minmax(0, 1fr); gap: 8px; }
  .setup { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: center; border-bottom: 1px solid var(--rule); padding-bottom: 8px; }
  .feedback { display: flex; align-items: center; gap: 20px; min-width: 0; }
  .feedback svg { width: 57%; max-width: 300px; height: 74px; }
  .wire { stroke: var(--ink-3); fill: none; stroke-width: 1.2; }
  .block { fill: var(--plot); stroke: var(--ink-3); }
  .forward { stroke: var(--s1); }
  .feedback-block { stroke: var(--brand); }
  .diagram-math { fill: var(--ink); font: italic 20px var(--math); }
  .diagram-math.blue { fill: var(--s1); }
  .diagram-math.green { fill: var(--brand); }
  .diagram-label, .sign { fill: var(--ink-2); font: 12px var(--mono); }
  .equation-stack { display: grid; justify-items: center; gap: 1px; white-space: nowrap; }
  .equation { display: flex; align-items: center; justify-content: center; gap: 5px; font: 21px var(--math); }
  .fraction { display: inline-grid; text-align: center; font-size: 18px; }
  .fraction > span:first-child { border-bottom: 1px solid var(--ink-3); }
  .fraction > span { padding: 0 5px; }
  .bandwidth-equation { font: 16px var(--math); color: var(--ink-2); }
  .bandwidth-equation sub { font-size: 9px; }
  .equation-caption { font: 10px var(--sans); color: var(--ink-3); text-align: center; }
  .design-controls { display: grid; gap: 6px; min-width: 0; }
  .constraint-row { display: flex; align-items: center; gap: 12px; }
  .constraint-row > .label { font-size: 10px; }
  .bandwidth-control :global(.range) { display: grid; grid-template-columns: 145px minmax(40px, 1fr) 11ch; gap: 10px; width: 100%; }
  .bandwidth-control :global(input) { width: 100%; min-width: 0; }
  .bandwidth-control :global(output) { width: 11ch; font-size: 12px; text-align: right; }
  .bandwidth-control :global(label) { font-size: 10px; letter-spacing: .025em; }
  .mode-note { margin: 0; color: var(--ink-3); font-size: 11px; line-height: 16px; min-height: 16px; display: flex; gap: 18px; }
  .relationship { color: var(--ink-2); }
  .response { min-width: 0; min-height: 0; }
  @media (max-width: 900px) {
    .amplifier-page { padding: 8px 16px; gap: 7px; }
    .setup { gap: 12px; }
    .feedback { gap: 6px; }
    .feedback svg { width: 66%; height: 64px; }
    .equation { font-size: 18px; }
    .fraction { font-size: 16px; }
    .bandwidth-equation { font-size: 14px; }
    .constraint-row { gap: 6px; }
    .constraint-row :global(.sm button) { font-size: 11px; }
    .bandwidth-control :global(.range) { grid-template-columns: 129px minmax(30px, 1fr) 10ch; gap: 6px; }
    .bandwidth-control :global(output) { width: 10ch; }
    .mode-note { font-size: 10px; gap: 8px; }
  }
  @media (max-width: 600px) {
    .setup { grid-template-columns: minmax(0, 1fr); padding-bottom: 6px; }
    .feedback { justify-content: center; }
    .feedback svg { display: none; }
    .constraint-row :global(.sm button) { font-size: 11px; }
    .constraint-row :global(.seg) { flex: 1; }
    .design-controls { gap: 5px; }
    .mode-note { display: grid; gap: 0; line-height: 14px; min-height: 28px; }
    :global(body:has(.amplifier-page) .site-footer .footer-inner) { padding: 6px 16px; gap: 3px 12px; font-size: 10px; }
    :global(body:has(.amplifier-page) .site-footer .brand) { font-size: 11px; }
    :global(body:has(.amplifier-page) .site-footer nav) { width: auto; }
    :global(body:has(.amplifier-page) .site-footer .visitors) { font-size: 10px; }
  }
</style>

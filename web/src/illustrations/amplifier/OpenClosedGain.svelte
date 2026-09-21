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
  <GainCase id="amplifier" bind:a0Db bind:betaDial {bandwidth} {constraint} {low} {high} bind:probe>
    {#snippet intro()}
      <div class="feedback">
        <svg viewBox="0 0 420 106" role="img" aria-label="Negative feedback: input minus beta times output drives amplifier A(s). Closed-loop gain T equals A divided by one plus beta A.">
          <g class="wire"><path d="M12 30H74 M106 30H150 M246 30H397 M302 30V83H244 M184 83H90V46" /><path d="m65 26 9 4-9 4 m76-8 9 4-9 4 m238-8 9 4-9 4 M253 79l-9 4 9 4 M86 55l4-9 4 9" /></g>
          <circle class="block" cx="90" cy="30" r="16" /><rect class="block forward" x="150" y="10" width="96" height="40" rx="4" /><rect class="block feedback-block" x="184" y="67" width="60" height="32" rx="4" />
          <text x="87" y="34" class="diagram-math">Σ</text><text x="73" y="14" class="sign">+</text><text x="101" y="56" class="sign">−</text>
          <text x="198" y="36" text-anchor="middle" class="diagram-math blue">A(s)</text><text x="214" y="88" text-anchor="middle" class="diagram-math green">β</text>
          <text x="12" y="17" class="diagram-label">Vin</text><text x="358" y="17" class="diagram-label">Vout</text><circle cx="302" cy="30" r="3" fill="var(--ink-3)" />
        </svg>
        <div class="equation-stack">
          <div class="formula equation"><var>T</var> = <span class="fraction"><span><var>A</var></span><span>1 + <var>βA</var></span></span></div>
          <div class="formula bandwidth-equation"><var>f</var><sub>CL</sub> = <var>f</var><sub>OL</sub>(1 + <var>βA</var><sub>0</sub>)</div>
        </div>
      </div>
    {/snippet}
    {#snippet hold()}
      <div class="constraint-row">
        <span class="label">Hold constant</span>
        <Segmented label="Quantity held constant" size="sm" options={[{ value: 'open-loop', label: 'Open-loop · fOL' }, { value: 'closed-loop', label: 'Closed-loop · fCL' }]} bind:value={constraint} />
      </div>
    {/snippet}
    {#snippet bandwidthControl()}
      {#if constraint === 'open-loop'}
        <Range id="amplifier-bandwidth" bind:value={openBwLog} min={0} max={6} step={0.05} output={frequency(bandwidth, 4)}>Open-loop bandwidth <var>f</var><sub>OL</sub></Range>
      {:else}
        <Range id="amplifier-bandwidth" bind:value={closedBwLog} min={1} max={8} step={0.05} output={frequency(bandwidth, 4)}>Closed-loop bandwidth <var>f</var><sub>CL</sub></Range>
      {/if}
    {/snippet}
    {#snippet modeNote()}
      <p class="mode-note"><span>{constraint === 'open-loop' ? 'Changing β moves fCL while A₀ and fOL stay fixed.' : 'Changing A₀ or β solves the fOL and GBW needed to keep fCL fixed.'}</span><span class="relationship">β = 0 removes feedback: L = 0 and T = A.</span></p>
    {/snippet}
  </GainCase>
</main>

<style>
  /* This lesson fills the space between the existing header and real visitor footer. */
  :global(body:has(.amplifier-page)) { height: 100dvh; min-height: 0; }
  :global(body:has(.amplifier-page) > .site-header), :global(body:has(.amplifier-page) > .site-footer) { flex-shrink: 0; }
  :global(body:has(.amplifier-page) #main-content) { flex: 1 1 0; min-height: 0; display: flex; }
  :global(body:has(.amplifier-page) #main-content > astro-island) { display: flex; flex: 1; min-width: 0; min-height: 0; }
  :global(body:has(.amplifier-page) .site-footer .footer-inner) { padding-block: 9px; }
  .amplifier-page { width: 100%; height: 100%; min-width: 0; min-height: 0; max-width: 1540px; padding: 12px 24px 9px; grid-template-rows: minmax(0, 1fr); }
  .feedback { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; }
  .feedback svg { width: 100%; min-width: 0; height: 78px; }
  .wire { stroke: var(--ink-3); fill: none; stroke-width: 1.2; }
  .block { fill: var(--plot); stroke: var(--ink-3); }
  .forward { stroke: var(--s1); }
  .feedback-block { stroke: var(--brand); }
  .diagram-math { fill: var(--ink); font: italic 20px var(--math); }
  .diagram-math.blue { fill: var(--s1); }
  .diagram-math.green { fill: var(--brand); }
  .diagram-label, .sign { fill: var(--ink-2); font: 12px var(--mono); }
  .equation-stack { display: grid; justify-items: center; gap: 7px; white-space: nowrap; }
  .formula { color: var(--ink); font: 21px/1.2 var(--math); font-weight: 400; }
  .equation { display: flex; align-items: center; justify-content: center; gap: 5px; }
  .fraction { display: inline-grid; text-align: center; font-size: inherit; }
  .fraction > span:first-child { border-bottom: 1px solid var(--ink-3); }
  .fraction > span { padding: 0 5px; }
  .bandwidth-equation sub { font-size: .62em; }
  .constraint-row { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px 10px; }
  .constraint-row > .label { font-size: 10px; color: var(--ink-2); text-transform: uppercase; letter-spacing: .055em; white-space: nowrap; }
  .constraint-row :global(.seg) { min-width: 0; width: 100%; justify-self: stretch; }
  .constraint-row :global(button) { min-width: 0; flex: 1 1 0; overflow: hidden; text-overflow: ellipsis; }
  .mode-note { margin: 0; color: var(--ink-3); font-size: 10px; line-height: 15px; display: grid; gap: 1px; }
  .relationship { color: var(--ink-2); }
  @media (min-width: 821px) and (max-height: 740px) {
    .feedback { display: block; }
    .feedback svg { display: none; }
    .equation-stack { grid-template-columns: auto auto; justify-content: space-between; align-items: center; }
    .mode-note { font-size: 9px; line-height: 12px; }
  }
  @media (max-width: 900px) {
    .amplifier-page { padding: 8px 16px; }
    .feedback { gap: 5px; }
    .feedback svg { height: 66px; }
    .formula { font-size: 18px; }
    .constraint-row :global(.sm button) { font-size: 11px; }
  }
  @media (max-width: 820px) {
    .feedback { justify-content: center; }
    .feedback svg { display: none; }
    .constraint-row :global(.sm button) { font-size: 11px; }
    .constraint-row :global(.seg) { flex: 1; }
    .mode-note { gap: 0; line-height: 14px; }
    :global(body:has(.amplifier-page) .site-footer .footer-inner) { padding: 6px 16px; gap: 3px 12px; font-size: 10px; }
    :global(body:has(.amplifier-page) .site-footer .brand) { font-size: 11px; }
    :global(body:has(.amplifier-page) .site-footer nav) { width: auto; }
    :global(body:has(.amplifier-page) .site-footer .visitors) { font-size: 10px; }
  }
  @media (max-width: 520px) {
    .constraint-row { grid-template-columns: minmax(0, 1fr); gap: 5px; }
  }
</style>

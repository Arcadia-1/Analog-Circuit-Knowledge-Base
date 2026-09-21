<script lang="ts">
  import PoleRuler from './PoleRuler.svelte';
  import StepResponseChart from './StepResponseChart.svelte';
  import { frequency } from './model';
  import { formatTime, stepMetrics, twoPoleModel } from './twoPoleModel';

  let pole1Log = $state(1), pole2Log = $state(3);
  const model = $derived(twoPoleModel(10 ** pole1Log, 10 ** pole2Log));
  const metrics = $derived(stepMetrics(model));
  const repeated = $derived(pole1Log === pole2Log);
</script>

<main class="two-pole-page">
  <section class="setup" aria-label="Two-pole model and controls">
    <div class="model-copy">
      <div class="equation"><var>H</var>(<var>s</var>) = <span class="fraction"><span>1</span><span>(1 + <var>s</var>/<var>ω</var><sub>p1</sub>)(1 + <var>s</var>/<var>ω</var><sub>p2</sub>)</span></span></div>
      <p>Unity DC gain · two stable real poles · drag either pole left or right.</p>
    </div>
    <PoleRuler bind:pole1Log bind:pole2Log />
  </section>

  <section class="response" aria-label="Two-pole step response">
    <div class="response-head">
      <div>
        <h2>Unit-step response</h2>
        <p>{repeated ? 'The poles coincide: y(t) = 1 − (1 + ωpt)e^(−ωpt).' : `The slower pole at ${frequency(model.slowFrequency, 4)} sets the long tail; the second pole rounds the leading edge.`}</p>
      </div>
      <dl class="metrics">
        <div><dt>Separation</dt><dd>{repeated ? 'repeated pole' : `${Number(model.ratio.toPrecision(3))}×`}</dd></div>
        <div><dt>Slow τ</dt><dd>{formatTime(1 / model.slowRate)}</dd></div>
        <div><dt>10–90% rise</dt><dd>{formatTime(metrics.riseTime)}</dd></div>
        <div><dt>2% settling</dt><dd>{formatTime(metrics.settlingTime)}</dd></div>
      </dl>
    </div>
    <StepResponseChart {model} {metrics} />
  </section>
</main>

<style>
  :global(body:has(.two-pole-page)) { height: 100dvh; min-height: 0; }
  :global(body:has(.two-pole-page) > .site-header), :global(body:has(.two-pole-page) > .site-footer) { flex-shrink: 0; }
  :global(body:has(.two-pole-page) #main-content) { flex: 1 1 0; min-height: 0; display: flex; }
  :global(body:has(.two-pole-page) #main-content > astro-island) { display: flex; flex: 1; min-width: 0; min-height: 0; }
  :global(body:has(.two-pole-page) .site-footer .footer-inner) { padding-block: 9px; }
  .two-pole-page { width: 100%; height: 100%; min-height: 0; max-width: 1480px; margin: 0 auto; padding: 12px 24px 9px; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; }
  .setup { display: grid; grid-template-columns: minmax(330px, .82fr) minmax(480px, 1.18fr); align-items: center; gap: 34px; border-bottom: 1px solid var(--rule); padding-bottom: 9px; }
  .model-copy { min-width: 0; display: grid; gap: 4px; }
  .model-copy p, .response-head p { margin: 0; color: var(--ink-2); font-size: 11px; line-height: 1.35; }
  .equation { display: flex; align-items: center; gap: 6px; font: 20px var(--math); white-space: nowrap; }
  .fraction { display: inline-grid; text-align: center; font-size: 16px; }
  .fraction > span:first-child { border-bottom: 1px solid var(--ink-3); }
  .fraction > span { padding: 0 5px; }
  .fraction sub { font-size: 9px; }
  .response { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 7px; }
  .response-head { display: grid; grid-template-columns: minmax(260px, 1fr) auto; align-items: end; gap: 24px; }
  h2 { margin: 0 0 2px; font-size: 17px; line-height: 1.2; font-weight: 550; letter-spacing: -.015em; }
  .metrics { margin: 0; display: flex; align-items: end; gap: 22px; }
  .metrics div { display: grid; gap: 1px; }
  .metrics dt { color: var(--ink-3); font-size: 9px; line-height: 1.2; letter-spacing: .055em; text-transform: uppercase; white-space: nowrap; }
  .metrics dd { margin: 0; color: var(--ink); font: 12px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  @media (max-width: 900px) {
    .two-pole-page { padding: 9px 16px 7px; gap: 7px; }
    .setup { grid-template-columns: minmax(250px, .75fr) minmax(390px, 1.25fr); gap: 16px; padding-bottom: 6px; }
    .equation { font-size: 17px; }
    .fraction { font-size: 14px; }
    .metrics { gap: 12px; }
  }
  @media (max-width: 680px) {
    .setup { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    .model-copy { justify-items: center; }
    .model-copy p { display: none; }
    .response-head { grid-template-columns: minmax(0, 1fr); gap: 4px; }
    .response-head > div p { font-size: 10px; }
    .metrics { justify-content: space-between; gap: 5px; }
    .metrics dt { font-size: 8px; }
    .metrics dd { font-size: 10px; }
    :global(body:has(.two-pole-page) .site-footer .footer-inner) { padding: 6px 16px; gap: 3px 12px; font-size: 10px; }
    :global(body:has(.two-pole-page) .site-footer .brand) { font-size: 11px; }
    :global(body:has(.two-pole-page) .site-footer nav) { width: auto; }
    :global(body:has(.two-pole-page) .site-footer .visitors) { font-size: 10px; }
  }
</style>

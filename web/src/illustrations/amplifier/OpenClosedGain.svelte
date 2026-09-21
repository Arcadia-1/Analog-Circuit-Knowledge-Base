<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import GainCase from './GainCase.svelte';
  import { amplifier, frequency } from './model';

  let leftDb = $state(60), rightDb = $state(80), gbwLog = $state(5), gainDb = $state(20), probe = $state(-1);
  const gbw = $derived(10 ** gbwLog);
  const ideal = $derived(10 ** (gainDb / 20));
  const beta = $derived(1 / ideal);
  const a = $derived(amplifier(leftDb, gbw, gainDb));
  const b = $derived(amplifier(rightDb, gbw, gainDb));
  const weak = $derived(Math.min(a.loopDc, b.loopDc) < 10);
  function reset() { leftDb = 60; rightDb = 80; gbwLog = 5; gainDb = 20; probe = -1; }
</script>

<main class="page amplifier-page">
  <div class="top">
    <div><h1>Open-loop &amp; closed-loop gain</h1><p class="intro">Same gain–bandwidth product. What does a higher open-loop gain actually buy?</p></div>
    <div class="actions"><button onclick={reset}>Reset</button><Notes>
      <p><b>Model.</b> A linear, single-pole voltage amplifier with constant, real feedback <var>β</var>: <code>A(s) = A₀ / (1 + s / (2πfOL))</code>. The input is applied to the positive summing input; β times the output is subtracted. No extra poles, loading, noise, saturation or slew-rate limits are included.</p>
      <p><b>Three different gains.</b> A is the open-loop forward gain, L = βA is the loop gain, and T = A/(1 + βA) is the closed-loop input-to-output gain. All curves use the complex transfer functions. Since β is real and positive, ∠L = ∠A.</p>
      <p><b>Exact one-pole identities.</b> GBW is defined as A₀fOL. Then <code>T₀ = A₀/(1 + βA₀)</code>, <code>fCL = fOL(1 + βA₀)</code> and <code>T₀ × fCL = GBW</code>. Each bandwidth is the −3.0103 dB point relative to that curve’s own DC gain.</p>
      <p><b>Ideal gain and error.</b> The requested gain G = 1/β is approached only when βA₀ ≫ 1. The DC relative gain error <code>(G − T₀)/G = 1/(1 + βA₀)</code>. Only with strong feedback can we use <code>fCL ≈ GBW/G = βGBW</code>. G is the noninverting gain (also the noise gain); the inverting signal gain follows a different numerator.</p>
      <p><b>Two different unity crossings.</b> A reaches unity at <code>fu = fOL √(A₀² − 1)</code>, approximately GBW. L reaches unity at <code>fc = fOL √((βA₀)² − 1)</code>, only if βA₀ &gt; 1. A loop with DC gain ≤ 1 has no positive-frequency crossing. Neither crossing is the exact closed-loop −3 dB bandwidth.</p>
      <p><b>Read the plots.</b> Filled dots mark the two −3 dB bandwidths; hollow rings mark unity gain. The gray horizontal guide is G = 1/β. Move over either plot or use the frequency probe to inspect both cases together. The phase of L is identical to A and uses the blue curve. Values below −40 dB are clipped from the magnitude display.</p>
      <p><b>Scope.</b> This model isolates gain accuracy and the bandwidth tradeoff. It cannot predict multistage stability, phase-margin design, PSRR or large-signal distortion.</p>
      <p><a href="https://github.com/Arcadia-1/circuits-and-systems-classroom/blob/main/web/python/amplifier_feedback.py" target="_blank" rel="noreferrer">Executable Python reference ↗</a></p>
    </Notes></div>
  </div>

  <div class="setup">
    <div class="feedback">
      <svg viewBox="0 0 420 106" role="img" aria-label="Negative feedback: input minus beta times output drives amplifier A(s). Closed-loop gain T equals A divided by one plus beta A.">
        <g class="wire"><path d="M12 30H74 M106 30H150 M246 30H397 M302 30V83H244 M184 83H90V46" /><path d="m65 26 9 4-9 4 m76-8 9 4-9 4 m238-8 9 4-9 4 M253 79l-9 4 9 4 M86 55l4-9 4 9" /></g>
        <circle class="block" cx="90" cy="30" r="16" /><rect class="block forward" x="150" y="10" width="96" height="40" rx="4" /><rect class="block feedback-block" x="184" y="67" width="60" height="32" rx="4" />
        <text x="87" y="34" class="diagram-math">Σ</text><text x="73" y="14" class="sign">+</text><text x="101" y="56" class="sign">−</text>
        <text x="198" y="36" text-anchor="middle" class="diagram-math blue">A(s)</text><text x="214" y="88" text-anchor="middle" class="diagram-math green">β</text>
        <text x="12" y="17" class="diagram-label">Vin</text><text x="358" y="17" class="diagram-label">Vout</text><circle cx="302" cy="30" r="3" fill="var(--ink-3)" />
      </svg>
      <div class="equation"><var>T</var> = <span class="fraction"><span><var>A</var></span><span>1 + <var>βA</var></span></span><span class="equation-caption">single-pole · negative feedback</span></div>
    </div>
    <div class="shared-controls">
      <Range id="amp-gbw" bind:value={gbwLog} min={3} max={8} step={0.05} output={frequency(gbw, 4)}>Shared GBW</Range>
      <Range id="amp-gain" bind:value={gainDb} min={0} max={60} step={1} output="{Number(ideal.toPrecision(4))} V/V">Ideal gain · 1/β</Range>
      <div class="control-note"><span>β = <b>{Number(beta.toPrecision(4))}</b></span><span>G = <b>{gainDb} dB</b></span><span>GBW = A₀ × fOL</span></div>
    </div>
  </div>

  <div class="legend-row" aria-label="Plot legend">
    <span class="legend-item"><i class="stroke blue-line"></i>Open loop <var>A</var></span>
    <span class="legend-item"><i class="stroke loop-line"></i>Loop <var>L = βA</var></span>
    <span class="legend-item"><i class="stroke amber-line"></i>Closed loop <var>T</var></span>
    <span class="marker-key">● −3 dB &nbsp; ○ Unity gain</span>
  </div>

  <div class="cases">
    <GainCase id="case-1" title="Case 1" bind:a0Db={leftDb} {gbw} {gainDb} bind:probe />
    <GainCase id="case-2" title="Case 2" bind:a0Db={rightDb} {gbw} {gainDb} bind:probe />
  </div>

  <div class="probe-control"><Range id="amp-probe" bind:value={probe} min={-6} max={1} step={0.01} output={frequency(gbw * 10 ** probe, 4)}>Frequency probe</Range><span>Both plots · logarithmic frequency</span></div>
  <div class="takeaway">
    <div class="identity"><var>T</var><sub>0</sub> × <var>f</var><sub>CL</sub> = GBW</div>
    <p>{#if weak}Finite loop gain matters here: the requested gain is not reached. Read the actual DC gain; the exact gain × bandwidth identity still holds.{:else if leftDb === rightDb}The same A₀, GBW and β produce identical responses. Raise one A₀ to compare gain accuracy.{:else}Higher A₀ brings the DC gain closer to 1/β. At fixed GBW and β, fCL approaches β·GBW = {frequency(beta * gbw)}; it does not grow with A₀.{/if}</p>
  </div>
</main>

<style>
  .amplifier-page { height: auto; min-height: calc(100dvh - 125px); grid-template-rows: none; gap: 14px; padding-top: 20px; }
  .top { align-items: center; justify-content: space-between; }
  h1 { font-size: 24px; font-weight: 500; letter-spacing: -.025em; margin: 0; }
  .intro { color: var(--ink-2); font-size: 13px; margin: 4px 0 0; }
  .actions { display: flex; align-items: center; gap: 10px; }
  button { cursor: pointer; font: 13px var(--sans); color: var(--ink-2); border: 1px solid var(--rule); background: transparent; border-radius: 999px; padding: 4px 12px; }
  button:hover { color: var(--ink); border-color: var(--ink-3); }
  .setup { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; align-items: center; border-block: 1px solid var(--rule); padding: 10px 0; }
  .feedback { display: flex; align-items: center; gap: 16px; min-width: 0; }
  .feedback svg { width: 67%; max-width: 390px; height: 95px; flex-shrink: 1; }
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
  .shared-controls { display: grid; gap: 11px; min-width: 0; }
  .shared-controls :global(.range) { display: grid; grid-template-columns: 127px minmax(50px, 1fr) 11ch; gap: 12px; width: 100%; }
  .shared-controls :global(input) { min-width: 0; width: 100%; }
  .shared-controls :global(output) { width: 11ch; text-align: right; }
  .shared-controls :global(label) { font-size: 10px; letter-spacing: .04em; }
  .control-note { display: grid; grid-template-columns: 1fr .8fr 1.2fr; gap: 8px; color: var(--ink-3); font-size: 11px; }
  .control-note b { font: 11px var(--mono); font-variant-numeric: tabular-nums; }
  .control-note span { white-space: nowrap; }
  .control-note span:last-child { text-align: right; }
  .legend-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 24px; font-size: 12px; color: var(--ink-2); }
  .legend-item { display: inline-flex; align-items: center; gap: 7px; }
  .legend-item var { font-size: 15px; }
  .stroke { width: 23px; border-top: 2px solid; }
  .blue-line { color: var(--s1); }
  .amber-line { color: var(--s2); }
  .loop-line { color: var(--brand); border-top-style: dashed; }
  .marker-key { margin-left: auto; font-size: 11px; color: var(--ink-3); }
  .cases { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 44px; }
  .probe-control { display: flex; align-items: center; gap: 24px; border-top: 1px solid var(--rule); padding-top: 12px; }
  .probe-control :global(.range) { display: grid; grid-template-columns: 145px minmax(100px, 1fr) 12ch; flex: 1; width: 100%; }
  .probe-control :global(input) { width: 100%; min-width: 0; }
  .probe-control :global(label) { font-size: 10px; letter-spacing: .04em; }
  .probe-control > span { font-size: 11px; color: var(--ink-3); }
  .takeaway { display: flex; align-items: center; gap: 24px; padding: 12px 16px; border-left: 2px solid var(--brand); background: var(--chip); border-radius: 0 4px 4px 0; min-height: 64px; }
  .identity { font: 20px var(--math); white-space: nowrap; }
  .identity sub { font-size: 12px; }
  .takeaway p { font-size: 12px; color: var(--ink-2); margin: 0; max-width: 780px; }
  @media (max-width: 900px) {
    .amplifier-page { gap: 16px; }
    .setup { grid-template-columns: 1fr; gap: 12px; }
    .feedback { max-width: 540px; }
    .feedback svg { height: 85px; }
    .cases { grid-template-columns: minmax(0, 1fr); gap: 24px; }
    .cases :global(.case + .case) { border-top: 1px solid var(--rule); padding-top: 16px; }
    .probe-control > span { display: none; }
    .takeaway { gap: 12px; }
  }
  @media (max-width: 600px) {
    h1 { font-size: 22px; }
    .actions { margin-top: 6px; }
    .legend-row { gap: 4px 12px; font-size: 11px; }
    .marker-key { margin-left: 0; flex-basis: 100%; }
    .shared-controls :global(.range) { grid-template-columns: 114px minmax(40px, 1fr) 10ch; gap: 8px; }
    .shared-controls :global(output) { width: 10ch; font-size: 12px; }
    .control-note { font-size: 10px; }
    .control-note b { font-size: 10px; }
    .probe-control :global(.range) { grid-template-columns: 94px minmax(50px, 1fr) 10ch; }
    .probe-control :global(label) { white-space: normal; }
    .probe-control :global(output) { width: 10ch; font-size: 12px; }
    .takeaway { flex-direction: column; align-items: start; min-height: 136px; }
  }
</style>

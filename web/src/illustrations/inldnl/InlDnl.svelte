<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { nf } from '../../lib/format';
  import CodeChart from './CodeChart.svelte';
  import DensityChart from './DensityChart.svelte';
  import WeightRack from './WeightRack.svelte';
  import {
    chipTrim,
    counts,
    measureRamp,
    measureSine,
    shares,
    spectrum,
    staticError,
    transitions,
    type Reference,
    type Test,
  } from './model';

  // a 2 LSB bow over a 1 % unit capacitor: the bow owns the INL, the mismatch owns the DNL
  let n = $state(10);
  let sigma = $state(0.01);
  let chip = $state(3);
  let trim = $state(chipTrim(10, 0.01, 3));
  let bow = $state(2);
  let sCurve = $state(0);
  let test = $state<Test>('ramp');
  let reference = $state<Reference>('endpoint');
  let perCodeLog = $state(10);
  let hover = $state<number | null>(null);
  let hoverBin = $state<number | null>(null);

  const perCode = $derived(2 ** perCodeLog);
  const t = $derived(transitions(n, { trim, bow, sCurve }));
  /** sigma, New chip and a new resolution all deal a fresh set of weight errors; the rack then edits them one by one. */
  function deal(next: { n?: number; sigma?: number; chip?: number }) {
    n = next.n ?? n;
    sigma = next.sigma ?? sigma;
    chip = next.chip ?? chip;
    trim = chipTrim(n, sigma, chip);
  }
  const truth = $derived(staticError(t, reference));
  const hits = $derived(counts(shares(n, t, test), 2 ** n * perCode, 11));
  const ideal = $derived(shares(n, transitions(n, { trim: new Float64Array(n), bow: 0, sCurve: 0 }), test).map((v) => v * 2 ** n * perCode));
  const measured = $derived(test === 'ramp' ? measureRamp(hits, reference) : measureSine(hits, reference));
  const sp = $derived(spectrum(n, t));

  const span = (a: Float64Array) => `${nf(Math.min(...a), 2)} … ${nf(Math.max(...a), 2)}`;
</script>

<main class="page">
  <header class="top">
    <div class="pick">
      <span class="label">Resolution</span>
      <Segmented size="sm" mono label="Resolution in bits" options={[8, 10, 12].map((b) => ({ value: b, label: String(b) }))} bind:value={() => n, (b) => deal({ n: b })} />
      <span class="unit">bits</span>
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>aout/</code>: <a href="/doc/api/aout#adctoolbox.compute_inl_from_ramp"><code>compute_inl_from_ramp</code></a>, <a href="/doc/api/aout#adctoolbox.compute_inl_from_sine"><code>compute_inl_from_sine</code></a>, <code>_correct_inl</code>. <code>spectrum/</code>: <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a>. This page is the interactive companion to its examples <code>exp_a32</code>, <code>exp_a33</code> and <code>exp_g05</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_inl_dnl.py">python/adc_inl_dnl.py</a> feeds <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> the same histograms and the numbers agree to 0.01 LSB.</p>
      <p><b>The converter.</b> A binary capacitor DAC of <var>N</var> bits. Transition <var>k</var> is the input at which the code steps from <var>k</var> to <var>k</var> + 1, and an ideal converter puts it at <var>k</var> + ½. Unit-capacitor mismatch moves every weight and so every level built from it; the bow and the S-curve add the two lowest-order INL shapes on top, each zero at both ends of the range.</p>
      <p><b>Weights.</b> Every level of the DAC is a sum of capacitor weights, so a weight's error moves every level built from it and no others. Drag the MSB: its own carry at mid-scale swallows the whole error as one enormous DNL spike, and the INL breaks into two straight halves. Drag the LSB and almost nothing happens — the same percentage of a capacitor a thousand times smaller. Unit-cap mismatch and New chip just deal a fresh set of these errors, σ/√units on each weight.</p>
      <p><b>DNL</b> is how much wider than one LSB each code is, measured against the average code width, so a gain error never shows up in it. −1 LSB is a missing code: its two transitions have crossed and no input produces it. <b>INL</b> is the running sum of DNL, one value per transition — how far that transition has drifted from the straight line through the converter.</p>
      <p><b>Reference line.</b> INL only means something once you say which straight line it is measured against. <b>Endpoint</b> takes the line through the first and last transition, so the curve starts and ends at zero. <b>Best fit</b> takes the least-squares line, which usually reports about half as much INL without changing anything about the converter.</p>
      <p><b>Histogram tests.</b> A <b>ramp</b> sweeps the input uniformly, so each code is hit in proportion to its width and DNL is the histogram divided by its own mean, minus one. A <b>sine</b> is far easier to generate cleanly, but it spends its time at the ends of its swing, so its code density has to be undone by the arcsine law — ADCToolbox does that with −cos(π · cumsum / total) — and the mid-scale codes, which collect the fewest hits, come out the noisiest.</p>
      <p><b>How many samples.</b> Counting is a Poisson experiment: with <var>H</var> hits per code each DNL carries about 1/√<var>H</var> LSB of noise, and INL, being their running sum, wanders like a random walk of that step. That is the whole reason a production ramp test takes millions of samples. Watch the measured curve pull away from the true one as you take samples away.</p>
      <p><b>Spectrum.</b> 4096 conversions of a −0.5 dBFS sine through the same transition levels, rectangular window. A bow is an even error and lands in the second harmonic; an S-curve is odd and lands in the third; mismatch has no particular shape and lifts the whole floor.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Static error and test setup">
    <div class="group">
      <span class="label">Static error</span>
      <Range id="bow" min={-4} max={4} step={0.1} output="{nf(bow, 1)} LSB" bind:value={bow}>Bow</Range>
      <Range id="scurve" min={-4} max={4} step={0.1} output="{nf(sCurve, 1)} LSB" bind:value={sCurve}>S-curve</Range>
      <Range id="mismatch" min={0} max={0.05} step={0.0025} output="{nf(sigma * 100, 2)} %" bind:value={() => sigma, (v) => deal({ sigma: v })}>Unit-cap mismatch</Range>
      <button type="button" onclick={() => deal({ chip: chip + 1 })} title="Deal another set of capacitor errors">New chip</button>
    </div>
    <div class="group accent2">
      <span class="label">Test</span>
      <Segmented size="sm" label="Test signal" options={[{ value: 'ramp', label: 'Ramp' }, { value: 'sine', label: 'Sine' }]} bind:value={test} />
      <Range id="per" min={2} max={14} step={1} output="{perCode.toLocaleString('en')} / code" bind:value={perCodeLog}>Samples</Range>
      <Segmented size="sm" label="INL reference line" options={[{ value: 'endpoint', label: 'Endpoint' }, { value: 'fit', label: 'Best fit' }]} bind:value={reference} />
    </div>
  </section>

  <section class="weights" aria-label="Capacitor weights">
    <div class="side">
      <span class="label">Weights</span>
      <span class="hint">drag a capacitor off its nominal value, in %</span>
    </div>
    <WeightRack {trim} {n} onchange={(j, v) => (trim = trim.map((old, i) => (i === j ? v : old)))} />
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">DNL</span><span>code width, per code</span></span>
        <span><b>{span(truth.dnl)}</b> LSB · {truth.missing} missing</span>
      </div>
      <CodeChart truth={truth.dnl} measured={measured.dnl} {n} unit="DNL, LSB" {hover} onhover={(c) => (hover = c)} label="DNL per code" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">INL</span><span>transition drift, {reference === 'endpoint' ? 'endpoint line' : 'best-fit line'}</span></span>
        <span><b>{span(truth.inl)}</b> LSB · measured <b>{span(measured.inl)}</b></span>
      </div>
      <CodeChart truth={truth.inl} measured={measured.inl} {n} unit="INL, LSB" {hover} onhover={(c) => (hover = c)} label="INL per transition" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Code density</span><span>{test === 'ramp' ? 'uniform ramp' : 'full-scale sine'}</span></span>
        <span>{(2 ** n * perCode).toLocaleString('en')} samples</span>
      </div>
      <DensityChart counts={hits} {ideal} {n} {hover} onhover={(c) => (hover = c)} label="Code density histogram" />
    </div>
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Spectrum</span><span>what the static error costs, −0.5 dBFS sine</span></span>
        <span>ENOB <b>{nf(sp.enob, 2)}</b> · SFDR <b>{nf(sp.sfdr, 1)} dB</b></span>
      </div>
      <SpectrumChart spectrum={sp} {n} series={1} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Output spectrum" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 36px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .weights { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 20px; }
  .side { display: grid; gap: 1px; padding-bottom: 12px; }
  .hint { font-size: 12.5px; color: var(--ink-3); }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
  .group .label { color: var(--ink-3); }
  .group.accent2 :global(.range) { --range-output-width: 13ch; }
  .compare { --rows: minmax(0, 1fr) minmax(0, 1fr); }
  button { font: 500 13px/1 var(--sans); color: var(--ink-2); background: var(--plot); border: 1px solid var(--rule); border-radius: 7px; padding: 5px 10px; cursor: pointer; }
  button:hover { color: var(--ink); border-color: var(--ink-3); }
</style>

<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { nf } from '../../lib/format';
  import BinChart from './BinChart.svelte';
  import PdfChart from './PdfChart.svelte';
  import {
    byPhase,
    byValue,
    capture,
    errorSpectrum,
    fitSine,
    FS,
    outputSpectrum,
    pdf,
    QUIET,
    TEST_BIN,
    type Impairments,
  } from './model';

  /** One impairment at a realistic level, so each fingerprint can be called up on its own. */
  const PRESETS: { label: string; imp: Impairments }[] = [
    { label: 'Nothing', imp: { ...QUIET } },
    { label: 'Noise', imp: { ...QUIET, noise: 2 } },
    { label: 'Static', imp: { ...QUIET, k2: 0.01 } },
    { label: 'Jitter', imp: { ...QUIET, jitter: 2e-12 } },
    { label: 'Memory', imp: { ...QUIET, memory: 0.002 } },
    { label: 'Interferer', imp: { ...QUIET, amDepth: 0.01 } },
  ];

  let n = $state(12);
  let bin = $state(TEST_BIN);
  let imp = $state<Impairments>({ ...PRESETS[3].imp });
  let hover = $state<number | null>(null);
  let hoverPhase = $state<number | null>(null);
  let hoverPdf = $state<number | null>(null);
  let hoverOut = $state<number | null>(null);
  let hoverErr = $state<number | null>(null);

  const y = $derived(capture(n, bin, imp, 5));
  const fit = $derived(fitSine(y, bin));
  const value = $derived(byValue(y, fit.error));
  const phase = $derived(byPhase(fit.error, bin, fit.phase));
  // Keep the diagnostic axes fixed while input frequency moves. The last
  // coherent bin is the worst case for jitter and safely covers the other
  // impairments, whose voltage-domain scale is independent of frequency.
  const scaleBin = 2045;
  const scaleY = $derived(capture(n, scaleBin, imp, 5));
  const scaleFit = $derived(fitSine(scaleY, scaleBin));
  const scaleValue = $derived(byValue(scaleY, scaleFit.error));
  const dist = $derived(pdf(fit.error, Math.max(1.2, 3.5 * scaleFit.rmse)));
  const out = $derived(outputSpectrum(y, n));
  const err = $derived(errorSpectrum(fit.error, n));
  const span = $derived(Math.max(0.4, 1.2 * Math.max(...Array.from(scaleValue.rms).filter(Number.isFinite))));

  const fin = $derived((bin / 4096) * FS);
  // the extreme value bins hold a handful of samples each, so they are too noisy to read a trend off
  const peak = $derived.by(() => {
    const busy = value.counts.reduce((a, v) => a + v, 0) / value.counts.length / 4;
    let m = 0;
    for (let b = 0; b < value.mean.length; b++) if (value.counts[b] >= busy) m = Math.max(m, Math.abs(value.mean[b]));
    return m;
  });
</script>

<main class="page">
  <header class="top">
    <div class="pick">
      <span class="label">Resolution</span>
      <Segmented size="sm" mono label="Resolution in bits" options={[10, 12, 14].map((b) => ({ value: b, label: String(b) }))} bind:value={n} />
      <span class="unit">bits</span>
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>fundamentals/</code>: <a href="/doc/api/fundamentals#adctoolbox.fit_sine_4param"><code>fit_sine_4param</code></a>; <code>aout/</code>: <a href="/doc/api/aout#adctoolbox.analyze_error_by_value"><code>analyze_error_by_value</code></a>, <a href="/doc/api/aout#adctoolbox.analyze_error_by_phase"><code>analyze_error_by_phase</code></a>, <a href="/doc/api/aout#adctoolbox.analyze_error_pdf"><code>analyze_error_pdf</code></a>, <a href="/doc/api/aout#adctoolbox.analyze_error_spectrum"><code>analyze_error_spectrum</code></a>; <code>siggen/nonidealities.py</code>: <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_thermal_noise"><code>apply_thermal_noise</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_static_nonlinearity"><code>apply_static_nonlinearity</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_jitter"><code>apply_jitter</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_memory_effect"><code>apply_memory_effect</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_am_tone"><code>apply_am_tone</code></a>. This page is the interactive companion to its examples <code>exp_a01</code>, <code>exp_a02</code>, <code>exp_a03</code> and <code>exp_a21</code>–<code>exp_a22</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_error_views.py">python/adc_error_views.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same samples and every number here matches it.</p>
      <p><b>The method.</b> 4096 samples of a −1 dBFS sine at a coherent bin. Fit <var>A</var> cos <var>ωt</var> + <var>B</var> sin <var>ωt</var> + <var>C</var> by least squares at the known frequency, subtract it, and the residual is everything the converter did wrong. Its rms is what SNDR is made of; the four views below are four ways of asking where it came from. Take each impairment on its own first — the buttons do that — and learn its shape; then mix them and see which view still gives it away.</p>
      <p><b>Against the value</b> shows the residual sorted by the voltage the converter was looking at. A static curve is a function of exactly that, so it appears here as a clean shape and nowhere else. Noise, jitter and interference are unrelated to the value and average away to a flat line.</p>
      <p><b>Against the phase</b> sorts the same residual by where in the cycle it happened, and splits it three ways. An error proportional to the signal has power ∝ cos²φ; one proportional to the signal's <em>slope</em> has power ∝ sin²φ; noise has neither. Fitting the squared error to a constant plus cos 2φ separates them, which is ADCToolbox's AM / PM decomposition. Clock jitter is the textbook PM: it can only hurt where the signal is moving, so it vanishes at the peaks and is worst at the zero crossings. An interfering tone that multiplies the signal is the textbook AM.</p>
      <p><b>The distribution</b> is the residual's histogram against the Gaussian of the same rms. Quantisation alone is flat and one LSB wide; thermal noise is Gaussian; clipping and glitches put weight in the tails.</p>
      <p><b>The residual's own spectrum</b> answers one question the output spectrum cannot: is what is left a <em>line</em> or a <em>floor</em>? Static curvature leaves harmonics, an interferer leaves its own tone, jitter and thermal noise leave a floor — and jitter's floor is the one that grows with input frequency.</p>
      <p><b>Impairments</b> are applied in the order ADCToolbox's signal generator applies them: the static curve bends the input, the sampler carries jitter and a memory of the previous coarse sample, an interfering tone modulates it, thermal noise adds, and the quantiser rounds. <var>f</var><sub>s</sub> = 100 MS/s, so jitter reads in picoseconds.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Impairments">
    <div class="group">
      <span class="label">One at a time</span>
      <Segmented size="sm" label="Impairment preset" options={PRESETS.map((p) => ({ value: p.label, label: p.label }))} bind:value={() => PRESETS.find((p) => JSON.stringify(p.imp) === JSON.stringify(imp))?.label ?? '', (v) => (imp = { ...PRESETS.find((p) => p.label === v)!.imp })} />
    </div>
    <div class="group">
      <Range id="noise" min={0} max={4} step={0.1} output="{nf(imp.noise, 1)} LSB" bind:value={() => imp.noise, (v) => (imp = { ...imp, noise: v })}>Noise</Range>
      <Range id="k2" min={-2} max={2} step={0.05} output="{nf(imp.k2 * 100, 2)} %" bind:value={() => imp.k2 * 100, (v) => (imp = { ...imp, k2: v / 100 })}>Curve <var>k</var><sub>2</sub></Range>
      <Range id="k3" min={-2} max={2} step={0.05} output="{nf(imp.k3 * 100, 2)} %" bind:value={() => imp.k3 * 100, (v) => (imp = { ...imp, k3: v / 100 })}>Curve <var>k</var><sub>3</sub></Range>
      <Range id="jitter" min={0} max={5} step={0.1} output="{nf(imp.jitter * 1e12, 1)} ps" bind:value={() => imp.jitter * 1e12, (v) => (imp = { ...imp, jitter: v * 1e-12 })}>Jitter</Range>
      <Range id="memory" min={0} max={0.5} step={0.01} output="{nf(imp.memory * 100, 2)} %" bind:value={() => imp.memory * 100, (v) => (imp = { ...imp, memory: v / 100 })}>Memory</Range>
      <Range id="am" min={0} max={2} step={0.05} output="{nf(imp.amDepth * 100, 2)} %" bind:value={() => imp.amDepth * 100, (v) => (imp = { ...imp, amDepth: v / 100 })}>Interferer</Range>
      <Range id="fin" min={51} max={2045} step={2} output="{nf(fin / 1e6, 2)} MHz" bind:value={bin}>Input</Range>
    </div>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap">
        <span class="left"><span class="label">Output spectrum</span><span>what you measure first</span></span>
        <span>ENOB <b>{nf(out.enob, 2)}</b> · SFDR <b>{nf(out.sfdr, 1)} dB</b> · the residual below accounts for all of it, <b>{nf(fit.rmse, 3)} LSB</b> rms</span>
      </div>
      <SpectrumChart spectrum={out} {n} series={1} hover={hoverOut} onhover={(b) => (hoverOut = b)} label="Output spectrum" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Against the value</span><span>static curvature lives here</span></span>
        <span>peak <b>{nf(peak, 2)}</b> LSB</span>
      </div>
      <BinChart
        bins={value}
        {span}
        ticks={[value.centers[0], 2 ** (n - 1), value.centers[value.centers.length - 1]].map((v) => ({ at: v, text: String(Math.round(v)) }))}
        unit="error vs code, LSB"
        {hover}
        onhover={(b) => (hover = b)}
        label="Residual against the signal value"
      />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Against the phase</span><span>AM / PM split</span></span>
        <span>on the signal <b>{nf(phase.am, 3)}</b> · on its slope <b>{nf(phase.pm, 3)}</b> · neither <b>{nf(phase.base, 3)}</b> LSB</span>
      </div>
      <BinChart
        bins={phase}
        {span}
        ticks={[{ at: 0, text: '0' }, { at: Math.PI, text: 'π' }, { at: 2 * Math.PI, text: '2π' }]}
        unit="error vs phase, LSB"
        hover={hoverPhase}
        onhover={(b) => (hoverPhase = b)}
        label="Residual against the phase of the input"
      />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Distribution</span><span>against a Gaussian of the same rms</span></span>
        <span>rms <b>{nf(fit.rmse, 3)}</b> LSB</span>
      </div>
      <PdfChart bins={dist} rms={fit.rmse} hover={hoverPdf} onhover={(b) => (hoverPdf = b)} label="Distribution of the residual" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">The residual alone</span><span>a line, or a floor?</span></span>
        <span>largest line <b>{nf(err.dbfs[err.signal], 1)} dBFS</b></span>
      </div>
      <SpectrumChart spectrum={err} {n} series={2} hover={hoverErr} onhover={(b) => (hoverErr = b)} label="Spectrum of the residual" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 32px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
  .group .label { color: var(--ink-3); }
  .compare { --rows: minmax(0, 0.78fr) minmax(0, 1fr) minmax(0, 1fr); }
  .wide { grid-column: 1 / -1; }
  @media (max-width: 900px) {
    .wide { grid-column: auto; }
  }
</style>

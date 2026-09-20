<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { nf } from '../../lib/format';
  import BinChart from '../errors/BinChart.svelte';
  import PdfChart from '../errors/PdfChart.svelte';
  import PolarChart from './PolarChart.svelte';
  import TimeChart from './TimeChart.svelte';
  import XYChart from './XYChart.svelte';
  import {
    analyze,
    CLEAN_IMPAIRMENTS,
    DEFAULT_IMPAIRMENTS,
    FIN,
    FIN_BIN,
    FS,
    HD_OFF,
    type Impairments,
  } from './model';

  const QUANTIZER_BITS = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  let imp = $state<Impairments>({ ...DEFAULT_IMPAIRMENTS });
  let bits = $state(12);
  let hoverSpectrum = $state<number | null>(null);
  let hoverValue = $state<number | null>(null);
  let hoverPhase = $state<number | null>(null);
  let hoverPdf = $state<number | null>(null);
  let hoverAcf = $state<number | null>(null);
  let hoverError = $state<number | null>(null);
  let hoverEnvelope = $state<number | null>(null);
  let hoverPlane = $state<number | null>(null);
  let hoverErrorPlane = $state<number | null>(null);

  const d = $derived(analyze(imp, bits));
  const span = $derived(Math.max(0.5, 1.15 * Math.max(...[...d.value.rms, ...d.phase.rms].filter(Number.isFinite))));
  const harmonicPeak = $derived(Math.max(...Array.from(d.decomposition.magnitudesDb.slice(1))));

  const set = (key: keyof Impairments, value: number) => (imp = { ...imp, [key]: value });
  const quantizerText = (value: number) => value ? `${value} bits` : 'off';
  const harmonicText = (value: number) => value <= HD_OFF ? 'off' : `${nf(value, 0)} dBc`;
</script>

<main class="page analog-panel">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Analog output analysis panel</h1>
    <p class="sub">The ADCToolbox 3 × 4 dashboard, live in the browser.</p>
    <div class="pick">
      <span class="label">Code scale</span>
      <Segmented size="sm" mono label="Code-unit scale in bits" options={[10, 12, 14].map((value) => ({ value, label: String(value) }))} bind:value={bits} />
      <span class="unit">bits</span>
    </div>
    <Notes>
      <p><b>Adapted from the ADCToolbox Analog panel.</b> The twelve views follow <a href="https://github.com/Arcadia-1/ADCToolbox/blob/main/python/src/adctoolbox/examples/06_use_toolsets/exp_t01_aout_dashboard_single.py"><code>exp_t01_aout_dashboard_single.py</code></a> and <a href="/doc/api/toolset#adctoolbox.toolset.generate_aout_dashboard"><code>generate_aout_dashboard</code></a>. This browser model uses 4096 points and a known-frequency sine fit.</p>
      <p><b>One composite converter.</b> Every control on the left acts on the same record, so noise, timing error, harmonics, memory, residue-stage errors, modulation, clipping, drift, reference droop and glitches can all coexist. Each slider carries its own physical unit; no shared severity factor or hidden background noise is applied. Code scale only expresses the result in LSB, while Quantizer explicitly enables conversion quantization.</p>
      <p><b>Phase and spectra.</b> Both polar views show cosine phase φ<sub>h</sub> − hφ<sub>1</sub>, with conjugation undone for a harmonic above Nyquist; radii are dBFS in the spectrum and dBc in decomposition. FFT plots use a rectangular window: noncoherent modulation and drift can spread over bins. The AM/PM readouts are a phase-dependent error-variance diagnostic, not a unique separation of all noise sources.</p>
      <p><b>How to read it.</b> A spectral line identifies periodic distortion; error by value exposes a static transfer curve; error by phase separates amplitude and timing effects; the PDF and autocorrelation show statistics and memory; the envelope spectrum isolates modulation; phase planes expose trajectories and rare escapes that are easy to miss in an FFT.</p>
    </Notes>
  </header>

  <section class="workspace">
    <aside class="controls" aria-label="Composite analog impairments">
      <div class="control-head">
        <div><span class="eyebrow">COMPOSITE ERRORS</span><strong>All effects add together</strong></div>
        <div class="actions">
          <button type="button" onclick={() => (imp = { ...DEFAULT_IMPAIRMENTS })}>Example mix</button>
          <button type="button" onclick={() => (imp = { ...CLEAN_IMPAIRMENTS })}>Clear</button>
        </div>
      </div>

      <div class="control-group">
        <h2>Noise & clock</h2>
        <div class="control-list">
          <Range id="analog-thermal" min={0} max={500} step={5} output="{nf(imp.thermalNoiseUv, 0)} µV rms" bind:value={() => imp.thermalNoiseUv, (v) => set('thermalNoiseUv', v)}>Thermal noise</Range>
          <Range id="analog-quantizer" min={0} max={QUANTIZER_BITS.length - 1} step={1} output={quantizerText(imp.quantizerBits)} bind:value={() => QUANTIZER_BITS.indexOf(imp.quantizerBits), (v) => set('quantizerBits', QUANTIZER_BITS[Math.round(v)])}>Quantizer</Range>
          <Range id="analog-jitter" min={0} max={5} step={0.05} output="{nf(imp.jitterPs, 2)} ps rms" bind:value={() => imp.jitterPs, (v) => set('jitterPs', v)}>Clock jitter</Range>
          <Range id="analog-am-noise" min={0} max={2000} step={25} output="{nf(imp.amNoisePpm, 0)} ppm rms" bind:value={() => imp.amNoisePpm, (v) => set('amNoisePpm', v)}>AM noise</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Static transfer</h2>
        <div class="control-list">
          <Range id="analog-hd2" min={HD_OFF} max={-40} step={1} output={harmonicText(imp.hd2Dbc)} bind:value={() => imp.hd2Dbc, (v) => set('hd2Dbc', v)}>H2</Range>
          <Range id="analog-hd3" min={HD_OFF} max={-40} step={1} output={harmonicText(imp.hd3Dbc)} bind:value={() => imp.hd3Dbc, (v) => set('hd3Dbc', v)}>H3</Range>
          <Range id="analog-clip" min={250} max={500} step={5} output="±{nf(imp.clipLevelMv, 0)} mV" bind:value={() => imp.clipLevelMv, (v) => set('clipLevelMv', v)}>Clip level</Range>
          <Range id="analog-ra-gain" min={-3} max={3} step={0.05} output="{imp.residueGainPct > 0 ? '+' : ''}{nf(imp.residueGainPct, 2)} %" bind:value={() => imp.residueGainPct, (v) => set('residueGainPct', v)}>Residue gain</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Memory & modulation</h2>
        <div class="control-list">
          <Range id="analog-memory" min={0} max={2} step={0.02} output="{nf(imp.memoryPct, 2)} %" bind:value={() => imp.memoryPct, (v) => set('memoryPct', v)}>MSB memory</Range>
          <Range id="analog-settling" min={0} max={120} step={2} output="{nf(imp.settlingTauPs, 0)} ps" bind:value={() => imp.settlingTauPs, (v) => set('settlingTauPs', v)}>Settling τ</Range>
          <Range id="analog-ra-dynamic" min={0} max={30} step={0.5} output="{nf(imp.dynamicResiduePctPerV2, 1)} %/V²" bind:value={() => imp.dynamicResiduePctPerV2, (v) => set('dynamicResiduePctPerV2', v)}>Dynamic residue</Range>
          <Range id="analog-am-tone" min={0} max={10} step={0.1} output="{nf(imp.amToneDepthPct, 1)} %" bind:value={() => imp.amToneDepthPct, (v) => set('amToneDepthPct', v)}>AM tone, 500 kHz</Range>
          <Range id="analog-drift" min={0} max={100} step={1} output="{nf(imp.driftStepUv, 0)} µV/√sample" bind:value={() => imp.driftStepUv, (v) => set('driftStepUv', v)}>Drift step</Range>
          <Range id="analog-reference" min={0} max={1} step={0.01} output="{nf(imp.referenceDroopPctPerV, 2)} %/V" bind:value={() => imp.referenceDroopPctPerV, (v) => set('referenceDroopPctPerV', v)}>Reference droop</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Sparse events</h2>
        <div class="control-list">
          <Range id="analog-glitch-rate" min={0} max={5000} step={50} output="{nf(imp.glitchRatePpm, 0)} ppm" bind:value={() => imp.glitchRatePpm, (v) => set('glitchRatePpm', v)}>Glitch rate</Range>
          <Range id="analog-glitch-amplitude" min={0} max={200} step={2} output="{nf(imp.glitchAmplitudeMv, 0)} mV" bind:value={() => imp.glitchAmplitudeMv, (v) => set('glitchAmplitudeMv', v)}>Glitch amplitude</Range>
        </div>
      </div>

      <span class="conditions"><b>{nf(FS / 1e6, 0)}</b> MS/s · <b>{nf(FIN / 1e6, 2)}</b> MHz · 4096 samples</span>
    </aside>

    <section class="panel-grid" aria-label="Twelve analog output analyses">
    <article class="chart">
      <div class="cap"><span class="label">1 · Spectrum</span><span>SNDR <b>{nf(d.output.sndr, 1)}</b> · SFDR <b>{nf(d.output.sfdr, 1)} dB</b></span></div>
      <SpectrumChart spectrum={d.output} n={bits} series={1} fs={FS} hover={hoverSpectrum} onhover={(v) => (hoverSpectrum = v)} label="Output spectrum" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">2 · Spectrum polar</span><span>magnitude + phase</span></div>
      <PolarChart data={d.outputPolar} label="Polar output spectrum" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">3 · Error by value</span><span>static transfer fingerprint</span></div>
      <BinChart bins={d.value} {span} ticks={[d.value.centers[0], 2 ** (bits - 1), d.value.centers[d.value.centers.length - 1]].map((at) => ({ at, text: String(Math.round(at)) }))} unit="error vs code, LSB" hover={hoverValue} onhover={(v) => (hoverValue = v)} label="Error against ADC output value" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">4 · Error by phase</span><span>AM {nf(d.phase.am, 2)} · PM {nf(d.phase.pm, 2)} LSB</span></div>
      <BinChart bins={d.phase} {span} ticks={[{ at: 0, text: '0' }, { at: Math.PI, text: 'π' }, { at: 2 * Math.PI, text: '2π' }]} unit="error vs phase, LSB" hover={hoverPhase} onhover={(v) => (hoverPhase = v)} label="Error against input phase" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">5 · Decomposition time</span><span>five harmonics + residual</span></div>
      <TimeChart signal={d.y} decomposition={d.decomposition} bin={FIN_BIN} label="Time-domain harmonic decomposition" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">6 · Decomposition polar</span><span>largest harmonic {nf(harmonicPeak, 1)} dBc</span></div>
      <PolarChart data={d.decompositionPolar} label="Polar harmonic decomposition" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">7 · Error PDF</span><span>rms <b>{nf(d.fit.rmse, 2)} LSB</b></span></div>
      <PdfChart bins={d.distribution} rms={d.fit.rmse} hover={hoverPdf} onhover={(v) => (hoverPdf = v)} label="Probability distribution of the error" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">8 · Error autocorrelation</span><span>memory across samples</span></div>
      <XYChart x={d.autocorr.x} y={d.autocorr.y} xLabel="lag" yLabel="correlation" label="Error autocorrelation" line series={1} hover={hoverAcf} onhover={(v) => (hoverAcf = v)} />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">9 · Error spectrum</span><span>residual lines and floor</span></div>
      <SpectrumChart spectrum={d.error} n={bits} series={2} fs={FS} hover={hoverError} onhover={(v) => (hoverError = v)} signalLabel="largest residual bin" label="Spectrum of the fitted-sine residual" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">10 · Error envelope spectrum</span><span>amplitude modulation</span></div>
      <SpectrumChart spectrum={d.envelopeSpectrum} n={bits} series={2} fs={FS} hover={hoverEnvelope} onhover={(v) => (hoverEnvelope = v)} signalLabel="largest envelope bin" label="Spectrum of the error envelope" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">11 · Phase plane</span><span>lag {d.phasePlane.lag} samples</span></div>
      <XYChart x={d.phasePlane.x} y={d.phasePlane.y} xLabel="x[n]" yLabel="x[n + lag]" label="Signal phase plane" series={1} hover={hoverPlane} onhover={(v) => (hoverPlane = v)} />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">12 · Error phase plane</span><span>residual vs amplitude</span></div>
      <XYChart x={d.errorPhasePlane.x} y={d.errorPhasePlane.y} xLabel="signal, V" yLabel="error, LSB" label="Error phase plane" series={2} hover={hoverErrorPlane} onhover={(v) => (hoverErrorPlane = v)} />
    </article>
    </section>
  </section>
</main>

<style>
  .analog-panel { max-width: 1760px; height: calc(100dvh - 103px); min-height: 700px; grid-template-rows: auto minmax(0, 1fr); gap: 10px; }
  .workspace { min-height: 0; display: grid; grid-template-columns: 332px minmax(0, 1fr); gap: 20px; border-top: 1px solid var(--rule); padding-top: 11px; }
  .controls { min-height: 0; overflow-y: auto; padding: 1px 8px 2px 0; scrollbar-width: thin; }
  .control-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
  .control-head > div:first-child { display: grid; gap: 1px; }
  .control-head strong { font-size: 12.5px; font-weight: 500; }
  .eyebrow { color: var(--ink-3); font: 10px var(--mono); letter-spacing: 0.12em; }
  .actions { display: flex; gap: 4px; }
  button { border: 1px solid var(--rule); border-radius: 4px; padding: 3px 6px; background: transparent; color: var(--ink-2); font: 10.5px var(--sans); cursor: pointer; }
  button:hover { border-color: var(--ink-3); color: var(--ink); }
  .control-group { border-top: 1px solid var(--rule); padding-top: 5px; margin-top: 5px; }
  .control-group h2 { margin: 0 0 2px; color: var(--ink-3); font: 10px var(--mono); text-transform: uppercase; letter-spacing: 0.11em; }
  .control-list { display: grid; gap: 0; --range-width: 76px; --range-output-width: 9.2ch; }
  :global(.control-list .range) { min-height: 25px; gap: 7px; }
  :global(.control-list .range label) { flex: 0 0 128px; width: 128px; font-size: 11.5px; text-transform: none; letter-spacing: 0; overflow: hidden; text-overflow: ellipsis; }
  :global(.control-list .range output) { font-size: 11.5px; text-align: right; }
  .conditions { display: block; margin-top: 8px; color: var(--ink-3); font: 10.5px var(--mono); white-space: nowrap; }
  .conditions b { color: var(--ink-2); font-weight: 500; }
  .panel-grid { min-height: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 12px 18px; }
  .chart { min-width: 0; }
  .cap { min-height: 19px; }
  .cap .label { color: var(--ink); }
  @media (max-width: 1150px) {
    .analog-panel { height: auto; }
    .workspace { grid-template-columns: minmax(0, 1fr); }
    .controls { overflow: visible; }
    .control-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
    .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; }
    .chart { height: 250px; }
  }
  @media (max-width: 700px) {
    .control-list { grid-template-columns: minmax(0, 1fr); }
    .panel-grid { grid-template-columns: minmax(0, 1fr); }
    .chart { height: 275px; }
  }
</style>

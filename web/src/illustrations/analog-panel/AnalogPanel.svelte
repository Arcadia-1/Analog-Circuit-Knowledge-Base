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
  import { analyze, CASES, FIN, FIN_BIN, FS, type CaseId } from './model';

  let caseId = $state<CaseId>('jitter');
  let severity = $state(100);
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

  const selected = $derived(CASES.find((item) => item.id === caseId) ?? CASES[0]);
  const d = $derived(analyze(caseId, severity / 100, bits));
  const span = $derived(Math.max(0.5, 1.15 * Math.max(...Array.from(d.value.rms).filter(Number.isFinite))));
  const harmonicPeak = $derived(Math.max(...Array.from(d.decomposition.magnitudesDb.slice(1))));
</script>

<main class="page analog-panel">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Analog output analysis panel</h1>
    <p class="sub">The ADCToolbox 3 × 4 dashboard, live in the browser.</p>
    <div class="pick">
      <span class="label">Resolution</span>
      <Segmented size="sm" mono label="ADC resolution" options={[10, 12, 14].map((value) => ({ value, label: String(value) }))} bind:value={bits} />
      <span class="unit">bits</span>
    </div>
    <Notes>
      <p><b>This is the Analog panel from ADCToolbox.</b> It preserves the 3 × 4 layout and the same twelve analyses as <a href="https://github.com/Arcadia-1/ADCToolbox/blob/main/python/src/adctoolbox/examples/06_use_toolsets/exp_t01_aout_dashboard_single.py"><code>exp_t01_aout_dashboard_single.py</code></a> and <a href="/doc/api/toolset#adctoolbox.toolset.generate_aout_dashboard"><code>generate_aout_dashboard</code></a>: spectrum, polar spectrum, error by value and phase, time and polar decomposition, error PDF and autocorrelation, error and envelope spectra, signal phase plane, and error phase plane.</p>
      <p><b>The error selector follows the batch example.</b> Its fifteen entries come from <code>exp_t02_aout_dashboard_batch.py</code>. At 100%, every model uses the example's nominal value. The severity slider scales that one non-ideality while all twelve panels recompute from the same deterministic capture.</p>
      <p><b>How to read it.</b> A spectral line identifies periodic distortion; error by value exposes a static transfer curve; error by phase separates amplitude and timing effects; the PDF and autocorrelation show statistics and memory; the envelope spectrum isolates modulation; phase planes expose trajectories and rare escapes that are easy to miss in an FFT.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Analog panel stimulus">
    <label class="case-pick">
      <span class="label">Non-ideality</span>
      <select bind:value={caseId} aria-label="Non-ideality">
        {#each CASES as item (item.id)}<option value={item.id}>{item.label}</option>{/each}
      </select>
    </label>
    <Range id="severity" min={0} max={200} step={5} output="{severity}%" bind:value={severity}>Severity</Range>
    <span class="fingerprint">{selected.fingerprint}</span>
    <span class="conditions"><b>{nf(FS / 1e6, 0)}</b> MS/s · <b>{nf(FIN / 1e6, 2)}</b> MHz · 4096 samples</span>
  </section>

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
      <SpectrumChart spectrum={d.error} n={bits} series={2} fs={FS} hover={hoverError} onhover={(v) => (hoverError = v)} label="Spectrum of the fitted-sine residual" />
    </article>

    <article class="chart">
      <div class="cap"><span class="label">10 · Error envelope spectrum</span><span>amplitude modulation</span></div>
      <SpectrumChart spectrum={d.envelopeSpectrum} n={bits} series={2} fs={FS} hover={hoverEnvelope} onhover={(v) => (hoverEnvelope = v)} label="Spectrum of the error envelope" />
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
</main>

<style>
  .analog-panel { max-width: 1760px; min-height: 760px; grid-template-rows: auto auto minmax(0, 1fr); gap: 10px; }
  .controls { min-width: 0; display: flex; align-items: center; gap: 10px 24px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .case-pick { display: flex; align-items: center; gap: 10px; }
  select { min-width: 172px; padding: 5px 30px 5px 9px; border: 1px solid var(--rule); border-radius: 5px; background: var(--plot); color: var(--ink); font: 13px var(--sans); }
  .fingerprint { min-width: 0; color: var(--ink-2); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .conditions { margin-left: auto; color: var(--ink-3); font: 12px var(--mono); white-space: nowrap; }
  .conditions b { color: var(--ink-2); font-weight: 500; }
  .panel-grid { min-height: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 12px 20px; border-top: 1px solid var(--rule); padding-top: 11px; }
  .chart { min-width: 0; }
  .cap { min-height: 19px; }
  .cap .label { color: var(--ink); }
  @media (max-width: 1150px) {
    .analog-panel { height: auto; }
    .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; }
    .chart { height: 250px; }
    .fingerprint { display: none; }
  }
  @media (max-width: 700px) {
    .controls { flex-wrap: wrap; }
    .conditions { width: 100%; margin-left: 0; }
    .panel-grid { grid-template-columns: minmax(0, 1fr); }
    .chart { height: 275px; }
  }
</style>

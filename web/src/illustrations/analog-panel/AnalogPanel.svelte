<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, nf } from '../../lib/format';
  import { coherentFrequency } from '../../lib/frequency';
  import BinChart from '../errors/BinChart.svelte';
  import PdfChart from '../errors/PdfChart.svelte';
  import PolarChart from './PolarChart.svelte';
  import TimeChart from './TimeChart.svelte';
  import XYChart from './XYChart.svelte';
  import {
    analyze,
    DEFAULT_IMPAIRMENTS,
    FIN,
    FS,
    HD_OFF,
    MAX_IMPAIRMENTS,
    MIN_IMPAIRMENTS,
    type Impairments,
  } from './model';

  const QUANTIZER_BITS = [0, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  interface PanelSnapshot {
    imp: Impairments;
    bits: number;
    fftExponent: number;
    inputMHz: number;
    seed: number;
  }

  let imp = $state<Impairments>({ ...DEFAULT_IMPAIRMENTS });
  let bits = $state(12);
  let fftExponent = $state(12);
  let inputMHz = $state(FIN / 1e6);
  let seed = $state(20260920);
  let previousStates = $state<PanelSnapshot[]>([]);
  let nextStates = $state<PanelSnapshot[]>([]);
  let editBaseline = $state<PanelSnapshot | null>(null);
  let hoverSpectrum = $state<number | null>(null);
  let hoverValue = $state<number | null>(null);
  let hoverPhase = $state<number | null>(null);
  let hoverPdf = $state<number | null>(null);
  let hoverAcf = $state<number | null>(null);
  let hoverError = $state<number | null>(null);
  let hoverEnvelope = $state<number | null>(null);
  let hoverPlane = $state<number | null>(null);
  let hoverErrorPlane = $state<number | null>(null);

  const points = $derived(2 ** fftExponent);
  // Keep the coherent tone on an odd bin coprime with the power-of-two record. Otherwise a selectable tone such as
  // fs/4 makes H3 coincide with H1 and a five-harmonic decomposition cannot identify them separately.
  const tone = $derived(coherentFrequency(FS, inputMHz * 1e6, points));
  const finBin = $derived(tone.bin);
  const fin = $derived(tone.fin);
  const d = $derived(analyze(imp, bits, { fs: FS, points, finBin }, seed));
  const span = $derived(Math.max(0.5, 1.15 * Math.max(...[...d.value.rms, ...d.phase.rms].filter(Number.isFinite))));
  const harmonicPeak = $derived(Math.max(...Array.from(d.decomposition.magnitudesDb.slice(1))));

  const set = (key: keyof Impairments, value: number) => (imp = { ...imp, [key]: value });
  const quantizerText = (value: number) => value ? `${value} bits` : 'off';
  const harmonicText = (value: number) => value <= HD_OFF ? 'off' : `${nf(value, 0)} dBc`;
  const eventText = (value: number) => `${value} ${value === 1 ? 'event' : 'events'}`;
  const setInputBin = (value: number) => (inputMHz = (value / points) * FS / 1e6);

  const snapshot = (): PanelSnapshot => ({ imp: { ...imp }, bits, fftExponent, inputMHz, seed });
  const same = (a: PanelSnapshot, b: PanelSnapshot) => JSON.stringify(a) === JSON.stringify(b);
  function remember(before: PanelSnapshot) {
    if (same(before, snapshot())) return;
    previousStates = [...previousStates.slice(-39), before];
    nextStates = [];
  }
  function beginEdit() {
    editBaseline ??= snapshot();
  }
  function commitEdit() {
    if (!editBaseline) return;
    const before = editBaseline;
    editBaseline = null;
    remember(before);
  }
  function changeNow(change: () => void) {
    commitEdit();
    const before = snapshot();
    change();
    remember(before);
  }
  function restore(state: PanelSnapshot) {
    imp = { ...state.imp };
    bits = state.bits;
    fftExponent = state.fftExponent;
    inputMHz = state.inputMHz;
    seed = state.seed;
    hoverSpectrum = hoverValue = hoverPhase = hoverPdf = hoverAcf = hoverError = hoverEnvelope = hoverPlane = hoverErrorPlane = null;
  }
  function previous() {
    commitEdit();
    const state = previousStates.at(-1);
    if (!state) return;
    const current = snapshot();
    previousStates = previousStates.slice(0, -1);
    nextStates = [...nextStates.slice(-39), current];
    restore(state);
  }
  function next() {
    commitEdit();
    const state = nextStates.at(-1);
    if (!state) return;
    const current = snapshot();
    nextStates = nextStates.slice(0, -1);
    previousStates = [...previousStates.slice(-39), current];
    restore(state);
  }
  const setBits = (value: number) => changeNow(() => (bits = value));
  const replaceImpairments = (value: Impairments) => changeNow(() => (imp = { ...value }));
  const setSign = (key: 'hd2Sign' | 'hd3Sign', value: number) => changeNow(() => set(key, value));

  function randomize() {
    changeNow(() => (seed = (seed + 1) >>> 0));
  }
</script>

<main class="page analog-panel">
  <section class="workspace">
    <aside class="controls" aria-label="Composite analog impairments">
      <div class="control-head">
        <div><span class="eyebrow">COMPOSITE ERRORS</span><strong>All effects combine in one record</strong></div>
        <div class="actions">
          <button type="button" onclick={randomize} title="Draw a new noise, jitter, drift, and glitch realization without changing any control">Random</button>
          <button type="button" onclick={() => replaceImpairments(MIN_IMPAIRMENTS)}>Min</button>
          <button type="button" onclick={() => replaceImpairments(MAX_IMPAIRMENTS)}>Max</button>
          <button class="previous" type="button" onclick={previous} disabled={!previousStates.length}>Previous</button>
          <button type="button" onclick={next} disabled={!nextStates.length}>Next</button>
        </div>
      </div>

      <div class="control-group">
        <h2>Capture</h2>
        <div class="control-list">
          <div class="choice-row">
            <span>Code scale</span>
            <Segmented size="sm" mono label="Code-unit scale in bits" options={[10, 12, 14].map((value) => ({ value, label: String(value) }))} bind:value={() => bits, setBits} />
            <output>bits</output>
          </div>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-input-frequency" min={1} max={points / 2 - 1} step={1} output={freqText(fin)} bind:value={() => finBin, setInputBin}>Input frequency</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-fft-points" min={6} max={18} step={1} output={points.toLocaleString('en-US')} bind:value={fftExponent}>FFT points</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Noise & clock</h2>
        <div class="control-list">
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-thermal" min={0} max={500} step={5} output="{nf(imp.thermalNoiseUv, 0)} µV rms" bind:value={() => imp.thermalNoiseUv, (v) => set('thermalNoiseUv', v)}>Thermal noise</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-quantizer" min={0} max={QUANTIZER_BITS.length - 1} step={1} output={quantizerText(imp.quantizerBits)} bind:value={() => QUANTIZER_BITS.indexOf(imp.quantizerBits), (v) => set('quantizerBits', QUANTIZER_BITS[Math.round(v)])}>Quantizer</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-jitter" min={0} max={5} step={0.05} output="{nf(imp.jitterPs, 2)} ps rms" bind:value={() => imp.jitterPs, (v) => set('jitterPs', v)}>Clock jitter</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-am-noise" min={0} max={2000} step={25} output="{nf(imp.amNoisePpm, 0)} ppm rms" bind:value={() => imp.amNoisePpm, (v) => set('amNoisePpm', v)}>AM noise</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Static transfer</h2>
        <div class="control-list">
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-hd2" min={HD_OFF} max={-40} step={1} output={harmonicText(imp.hd2Dbc)} bind:value={() => imp.hd2Dbc, (v) => set('hd2Dbc', v)}>
            {#snippet leading()}<span class="polarity" role="group" aria-label="H2 coefficient polarity"><button type="button" class:active={imp.hd2Sign < 0} aria-pressed={imp.hd2Sign < 0} title="Negative H2 coefficient" onclick={() => setSign('hd2Sign', -1)}>−</button><button type="button" class:active={imp.hd2Sign > 0} aria-pressed={imp.hd2Sign > 0} title="Positive H2 coefficient" onclick={() => setSign('hd2Sign', 1)}>+</button></span>{/snippet}
            {#snippet children()}H2{/snippet}
          </Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-hd3" min={HD_OFF} max={-40} step={1} output={harmonicText(imp.hd3Dbc)} bind:value={() => imp.hd3Dbc, (v) => set('hd3Dbc', v)}>
            {#snippet leading()}<span class="polarity" role="group" aria-label="H3 coefficient polarity"><button type="button" class:active={imp.hd3Sign < 0} aria-pressed={imp.hd3Sign < 0} title="Negative H3 coefficient" onclick={() => setSign('hd3Sign', -1)}>−</button><button type="button" class:active={imp.hd3Sign > 0} aria-pressed={imp.hd3Sign > 0} title="Positive H3 coefficient" onclick={() => setSign('hd3Sign', 1)}>+</button></span>{/snippet}
            {#snippet children()}H3{/snippet}
          </Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-clip" min={250} max={500} step={5} output="±{nf(imp.clipLevelMv, 0)} mV" bind:value={() => imp.clipLevelMv, (v) => set('clipLevelMv', v)}>Clip level</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-ra-gain" min={-3} max={3} step={0.05} output="{imp.residueGainPct > 0 ? '+' : ''}{nf(imp.residueGainPct, 2)} %" bind:value={() => imp.residueGainPct, (v) => set('residueGainPct', v)}>Residue gain</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Memory & modulation</h2>
        <div class="control-list">
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-memory" min={0} max={2} step={0.02} output="{nf(imp.memoryPct, 2)} %" bind:value={() => imp.memoryPct, (v) => set('memoryPct', v)}>MSB memory</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-settling" min={0} max={120} step={2} output="{nf(imp.settlingTauPs, 0)} ps" bind:value={() => imp.settlingTauPs, (v) => set('settlingTauPs', v)}>Settling τ</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-ra-dynamic" min={0} max={30} step={0.5} output="{nf(imp.dynamicResiduePctPerV2, 1)} %/V²" bind:value={() => imp.dynamicResiduePctPerV2, (v) => set('dynamicResiduePctPerV2', v)}>Dynamic residue</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-am-tone" min={0} max={10} step={0.1} output="{nf(imp.amToneDepthPct, 1)} %" bind:value={() => imp.amToneDepthPct, (v) => set('amToneDepthPct', v)}>AM tone, 500 kHz</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-drift" min={0} max={100} step={1} output="{nf(imp.driftStepUv, 0)} µV/√sample" bind:value={() => imp.driftStepUv, (v) => set('driftStepUv', v)}>Drift step</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-reference" min={0} max={1} step={0.01} output="{nf(imp.referenceDroopPctPerV, 2)} %/V" bind:value={() => imp.referenceDroopPctPerV, (v) => set('referenceDroopPctPerV', v)}>Reference droop</Range>
        </div>
      </div>

      <div class="control-group">
        <h2>Sparse events</h2>
        <div class="control-list">
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-glitch-count" min={0} max={32} step={1} output={eventText(imp.glitchCount)} bind:value={() => imp.glitchCount, (v) => set('glitchCount', v)}>Glitches / record</Range>
          <Range onstart={beginEdit} oncommit={commitEdit} id="analog-glitch-amplitude" min={0} max={200} step={2} output="{nf(imp.glitchAmplitudeMv, 0)} mV" bind:value={() => imp.glitchAmplitudeMv, (v) => set('glitchAmplitudeMv', v)}>Glitch amplitude</Range>
        </div>
      </div>

      <span class="conditions"><b>{nf(FS / 1e6, 0)}</b> MS/s · <b>{freqText(fin)}</b> · coherent bin {finBin} · {points.toLocaleString('en-US')} samples</span>
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
      <TimeChart signal={d.y} decomposition={d.decomposition} bin={finBin} label="Time-domain harmonic decomposition" />
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
  .analog-panel { max-width: 1760px; height: calc(100dvh - 103px); min-height: 700px; grid-template-rows: minmax(0, 1fr); gap: 0; }
  .workspace { min-height: 0; display: grid; grid-template-columns: 332px minmax(0, 1fr); gap: 20px; border-top: 1px solid var(--rule); padding-top: 11px; }
  .controls { min-height: 0; overflow-y: auto; padding: 1px 8px 2px 0; scrollbar-width: thin; }
  .control-head { display: grid; gap: 5px; margin-bottom: 8px; }
  .control-head > div:first-child { display: grid; gap: 1px; }
  .control-head strong { font-size: 12.5px; font-weight: 500; }
  .eyebrow { color: var(--ink-3); font: 10px var(--mono); letter-spacing: 0.12em; }
  .actions { display: flex; gap: 4px; }
  .actions .previous { margin-left: auto; }
  button { border: 1px solid var(--rule); border-radius: 4px; padding: 3px 6px; background: transparent; color: var(--ink-2); font: 10.5px var(--sans); cursor: pointer; }
  button:hover { border-color: var(--ink-3); color: var(--ink); }
  button:disabled { opacity: 0.35; cursor: default; }
  .control-group { border-top: 1px solid var(--rule); padding-top: 5px; margin-top: 5px; }
  .control-group h2 { margin: 0 0 2px; color: var(--ink-3); font: 10px var(--mono); text-transform: uppercase; letter-spacing: 0.11em; }
  .control-list { display: grid; gap: 0; --range-width: 76px; --range-output-width: 9.2ch; }
  .choice-row { min-height: 29px; display: flex; align-items: center; gap: 7px; color: var(--ink-2); font-size: 11.5px; }
  .choice-row > span { flex: 0 0 128px; width: 128px; }
  .choice-row output { margin-left: auto; width: 9.2ch; color: var(--ink); font: 11.5px var(--mono); text-align: right; }
  .choice-row :global(.seg) { border-radius: 5px; padding: 1px; }
  .choice-row :global(.seg button) { padding: 3px 6px; font-size: 10.5px; }
  :global(.control-list .range) { min-height: 25px; gap: 7px; }
  :global(.control-list .range label) { flex: 0 0 128px; width: 128px; font-size: 11.5px; text-transform: none; letter-spacing: 0; overflow: hidden; text-overflow: ellipsis; }
  :global(.control-list .range output) { font-size: 11.5px; text-align: right; }
  :global(.control-list .range.with-leading label) { flex-basis: 82px; width: 82px; }
  :global(.control-list .range.with-leading output) { flex-basis: 8.4ch; width: 8.4ch; }
  .polarity { flex: 0 0 39px; display: inline-flex; padding: 1px; border: 1px solid var(--rule); border-radius: 4px; background: var(--plot); }
  .polarity button { flex: 1 1 50%; min-width: 0; padding: 2px 3px; border: 0; border-radius: 3px; font: 11px/1 var(--mono); }
  .polarity button.active { color: var(--ink); background: var(--accent-soft, var(--chip)); box-shadow: inset 0 0 0 1px var(--accent, var(--ink-3)); }
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
    .control-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; --range-output-width: 12ch; }
    .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; }
    .chart { height: 250px; }
  }
  @media (max-width: 700px) {
    .control-list { grid-template-columns: minmax(0, 1fr); }
    .panel-grid { grid-template-columns: minmax(0, 1fr); }
    .chart { height: 275px; }
  }
</style>

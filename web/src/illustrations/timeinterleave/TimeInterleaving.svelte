<script lang="ts">
  import { freqText, nf } from '../../lib/format';
  import { foldFrequency } from '../../lib/frequency';
  import ContributionMap from './ContributionMap.svelte';
  import EditableRange from './EditableRange.svelte';
  import { analysisPoints, contributions, jitterOnlySnr, MAX_CHANNELS, MIN_CHANNELS, mismatch, read, thermalOnlySnr, type HarmonicLevels } from './model';
  import SampleTimingChart from './SampleTimingChart.svelte';
  import SpurSpectrum from './SpurSpectrum.svelte';

  let m = $state(4);
  let sampleRateGHz = $state(10);
  let inputGHz = $state(1);
  let gainPct = $state(0.3);
  let offsetMv = $state(1);
  let skewPs = $state(0.1);
  let analogBandwidthGHz = $state(5);
  let bandwidthPct = $state(2);
  let thermalNoiseLsb = $state(0.3);
  let jitterPs = $state(0.5);
  let h2Dbc = $state(-65);
  let h3Dbc = $state(-71);
  let h5Dbc = $state(-80);
  let h7Dbc = $state(-86);
  let decimation = $state(1);
  let bits = $state(12);
  let hoverBin = $state<number | null>(null);
  let hoverSample = $state<number | null>(null);

  const fs = $derived(sampleRateGHz * 1e9);
  const fftPoints = $derived(analysisPoints(m));
  const inputMinGHz = $derived(Math.max(0.001, sampleRateGHz / fftPoints));
  const inputMaxGHz = $derived(sampleRateGHz / 2 - sampleRateGHz / fftPoints);
  const harmonics: HarmonicLevels = $derived({ 2: h2Dbc, 3: h3Dbc, 5: h5Dbc, 7: h7Dbc });

  $effect(() => {
    inputGHz = Math.max(inputMinGHz, Math.min(inputMaxGHz, inputGHz));
  });

  const mm = $derived(mismatch(m, gainPct / 100, offsetMv / 1e3, skewPs / 1e12, bandwidthPct / 100));
  const analogBandwidth = $derived(analogBandwidthGHz * 1e9);
  const r = $derived(read(m, inputGHz * 1e9, mm, bits, 'off', { fs, analogBandwidth, thermalNoiseLsb, jitter: jitterPs / 1e12, harmonics, decimation }));
  const seen = $derived(foldFrequency(r.fin, fs / m));
  const sourceRows = $derived(contributions(mm, r.fin, fs, harmonics, r.fsOut, analogBandwidth));
  const thermalSnr = $derived(thermalOnlySnr(bits, thermalNoiseLsb, r.fin, analogBandwidth));
  const jitterSnr = $derived(jitterOnlySnr(r.fin, jitterPs / 1e12));
  const rateText = (hz: number) => freqText(hz).replace(/Hz$/, 'S/s');
  const snrText = (value: number) => Number.isFinite(value) ? `${nf(value, 1)} dB` : '∞';

  const randomStep = (min: number, max: number, step: number) => {
    const steps = Math.round((max - min) / step);
    return Number((min + Math.floor(Math.random() * (steps + 1)) * step).toFixed(8));
  };

  function clearImpairments() {
    gainPct = 0;
    offsetMv = 0;
    skewPs = 0;
    bandwidthPct = 0;
    thermalNoiseLsb = 0;
    jitterPs = 0;
    h2Dbc = h3Dbc = h5Dbc = h7Dbc = -100;
    hoverBin = hoverSample = null;
  }

  function randomizeImpairments() {
    gainPct = randomStep(0, 3, 0.05);
    offsetMv = randomStep(0, 8, 0.1);
    skewPs = randomStep(0, 2, 0.01);
    bandwidthPct = randomStep(0, 10, 0.1);
    thermalNoiseLsb = randomStep(0, 4, 0.05);
    jitterPs = randomStep(0, 5, 0.05);
    h2Dbc = randomStep(-100, -40, 1);
    h3Dbc = randomStep(-100, -40, 1);
    h5Dbc = randomStep(-100, -40, 1);
    h7Dbc = randomStep(-100, -40, 1);
    hoverBin = hoverSample = null;
  }
</script>

<main class="page">
  <section class="workspace">
    <aside class="control-panel" aria-label="Converter and error settings">
      <div class="quick-actions">
        <span>All impairments</span>
        <div>
          <button type="button" onclick={clearImpairments} title="Set channel mismatch, jitter, and source harmonics to zero; the selected ADC resolution remains active">Zero all</button>
          <button type="button" onclick={randomizeImpairments} title="Draw every channel mismatch, jitter, and harmonic level independently over its control range">Random</button>
        </div>
      </div>

      <div class="control-group sampling">
        <div class="group-head">
          <span class="label">Sampling</span>
          <span>{rateText(r.fsOut)} out · {r.fftPoints} FFT points</span>
        </div>
        <EditableRange id="channels" min={MIN_CHANNELS} max={MAX_CHANNELS} step={1} digits={0} unit="" bind:value={m}>Channels</EditableRange>
        <EditableRange id="bits" min={8} max={16} step={1} digits={0} unit="bits" bind:value={bits}>Resolution</EditableRange>
        <EditableRange id="sample-rate" min={0.5} max={10} step={0.1} digits={1} unit="GS/s" bind:value={sampleRateGHz}>Sampling Rate</EditableRange>
        <EditableRange id="input-frequency" min={inputMinGHz} max={inputMaxGHz} step={0.001} digits={3} unit="GHz" bind:value={inputGHz}>Input Rate</EditableRange>
        <EditableRange id="decimation" min={1} max={255} step={1} digits={0} unit="" prefix="÷" bind:value={decimation}>Decimation</EditableRange>
        <div class="sampling-readout">
          <span>actual input <b>{freqText(r.fin)}</b> · channel <b>{rateText(fs / m)}</b> · sees <b>{freqText(seen)}</b></span>
        </div>
      </div>

      <div class="control-group accent2">
        <div class="group-head"><span class="label">Analog front end</span><span>mismatch · rms</span></div>
        <EditableRange id="analog-bandwidth" min={0.1} max={20} step={0.1} digits={1} unit="GHz" bind:value={analogBandwidthGHz}>Analog Bandwidth</EditableRange>
        <EditableRange id="offset" min={0} max={8} step={0.1} digits={1} unit="mV" bind:value={offsetMv}>Offset</EditableRange>
        <EditableRange id="gain" min={0} max={3} step={0.05} digits={2} unit="%" bind:value={gainPct}>Gain</EditableRange>
        <EditableRange id="skew" min={0} max={2} step={0.01} digits={2} unit="ps" bind:value={skewPs}>Skew</EditableRange>
        <EditableRange id="bandwidth" min={0} max={10} step={0.1} digits={1} unit="%" bind:value={bandwidthPct}>BW mismatch</EditableRange>
      </div>

      <div class="control-group source">
        <div class="group-head"><span class="label">Noise, clock &amp; source</span></div>
        <EditableRange id="thermal-noise" min={0} max={4} step={0.05} digits={2} unit="LSB rms" bind:value={thermalNoiseLsb}>Thermal noise</EditableRange>
        <EditableRange id="jitter" min={0} max={5} step={0.05} digits={2} unit="ps" bind:value={jitterPs}>Jitter</EditableRange>
        <div class="noise-readout" aria-label="Expected signal-to-noise ratios from each noise source alone">
          <span title="Thermal noise only: 20 log10[(A·|H(fin)|/√2)/(σthermal·LSB)]">Thermal-only SNR <b>{snrText(thermalSnr)}</b></span>
          <span title="Aperture jitter only: −20 log10(2π·fin·σt)">Jitter-only SNR <b>{snrText(jitterSnr)}</b></span>
        </div>
        <EditableRange id="h2" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h2Dbc}>H2</EditableRange>
        <EditableRange id="h3" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h3Dbc}>H3</EditableRange>
        <EditableRange id="h5" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h5Dbc}>H5</EditableRange>
        <EditableRange id="h7" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h7Dbc}>H7</EditableRange>
      </div>
    </aside>

    <section class="visuals" aria-label="Time and frequency views">
      <div class="chart time-chart">
        <div class="cap">
          <span class="left"><span class="label">Time domain</span><span>{freqText(r.fin)} input · 48 converter samples{decimation > 1 ? ` · grey bands kept by ÷${decimation}` : ' before decimation'}</span></span>
        </div>
        <SampleTimingChart samples={r.rawData} truth={r.truth} fin={r.fin} {fs} {harmonics} {decimation} hover={hoverSample} onhover={(i) => (hoverSample = i)} label="Time-domain input and interleaved channel samples" />
      </div>

      <div class="chart spectrum-chart">
        <div class="cap">
          <span class="left"><span class="label">Output spectrum</span><span>{r.fftPoints}-point FFT · {rateText(r.fsOut)} · {r.coherent ? 'rectangular' : 'Blackman–Harris'}</span></span>
          <span title={r.metricsResolved ? (r.coherent ? 'Coherent FFT estimates' : 'SNDR: known-frequency sine fit. SFDR: strongest windowed residual lobe. Closely spaced tones may not resolve.') : 'Noncoherent record has fewer than 64 points, or the carrier is within five bins of DC / Nyquist'}>SFDR <b>{r.metricsResolved ? nf(r.raw.sfdr, 1) : '—'} dB</b> · SNDR <b>{r.metricsResolved ? nf(r.raw.sndr, 1) : '—'} dB</b> · ENOB <b>{r.metricsResolved ? nf(r.raw.enob, 2) : '—'} bits</b></span>
        </div>
        <SpurSpectrum spectrum={r.raw} spurs={r.spurs} harmonics={r.harmonics} {bits} fs={r.fsOut} points={r.fftPoints} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Spectrum of the interleaved and decimated output" />
      </div>

      <div class="chart contribution-chart">
        <div class="cap">
          <span class="left"><span class="label">Where each imperfection appears</span><span>M = channels · k = spur index · h = harmonic order · folded to output Nyquist</span></span>
        </div>
        <ContributionMap rows={sourceRows} fs={r.fsOut} points={r.fftPoints} label="Discrete spectral signatures of offset, gain, timing, bandwidth, and harmonics" />
      </div>
    </section>
  </section>
</main>

<style>
  .page { height: calc(100dvh - 103px); min-height: 0; grid-template-rows: minmax(0, 1fr); max-width: 1600px; padding-block: 10px 8px; gap: 0; }
  .workspace { min-width: 0; min-height: 0; display: grid; grid-template-columns: minmax(330px, 380px) minmax(0, 1fr); gap: 26px; align-items: stretch; }
  .control-panel { min-width: 0; min-height: 0; display: grid; gap: 6px; align-content: start; }
  .quick-actions { min-height: 24px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 4px; color: var(--ink-3); font-size: 11.5px; }
  .quick-actions > div { display: flex; gap: 5px; }
  .quick-actions button { border: 1px solid var(--rule); border-radius: 4px; padding: 3px 8px; background: var(--plot); color: var(--ink-2); font: 11px var(--sans); cursor: pointer; }
  .quick-actions button:hover { border-color: var(--ink-3); color: var(--ink); }
  .control-group { min-width: 0; display: grid; gap: 2px; padding: 6px 12px; border: 1px solid var(--rule); border-radius: 5px; }
  .group-head { min-height: 18px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--ink-3); font-size: 11.5px; }
  .group-head > :last-child { text-align: right; }
  .sampling-readout { min-width: 0; padding-top: 4px; border-top: 1px solid var(--rule); color: var(--ink-3); font-size: 10.5px; white-space: nowrap; }
  .sampling-readout b { color: var(--ink); font: 500 10.5px var(--mono); }
  .source { --accent: var(--s1); }
  .noise-readout { min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 3px 0 4px; border-bottom: 1px solid var(--rule); color: var(--ink-3); font-size: 10.5px; white-space: nowrap; }
  .noise-readout b { color: var(--ink); font: 500 10.5px var(--mono); }
  .visuals { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(160px, .9fr) minmax(220px, 1.3fr) minmax(160px, .8fr); gap: 10px; }
  .chart { min-width: 0; }
  .cap { min-height: 20px; }
  @media (max-width: 1050px) and (min-width: 901px) {
    .workspace { grid-template-columns: 330px minmax(0, 1fr); gap: 18px; }
  }
  @media (max-width: 900px) {
    .page { height: auto; min-height: 0; padding-block: 16px 28px; }
    .workspace { grid-template-columns: minmax(0, 1fr); }
    .control-panel { position: static; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .quick-actions { grid-column: 1 / -1; }
    .sampling { grid-row: span 2; }
    .visuals { grid-template-rows: 300px 320px 270px; }
  }
  @media (max-width: 700px) {
    .control-panel { grid-template-columns: minmax(0, 1fr); }
    .sampling { grid-row: auto; }
    .visuals { grid-template-rows: 280px 300px 260px; }
  }
  @media (min-width: 901px) and (max-height: 700px) {
    .page { height: auto; min-height: 600px; }
    .workspace { align-items: start; }
    .visuals { grid-template-rows: 180px 230px 170px; }
  }
</style>

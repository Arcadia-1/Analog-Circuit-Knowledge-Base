<script lang="ts">
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, nf } from '../../lib/format';
  import { foldFrequency } from '../../lib/frequency';
  import ContributionMap from './ContributionMap.svelte';
  import EditableRange from './EditableRange.svelte';
  import { CHANNELS, contributions, mismatch, N, read, type HarmonicLevels } from './model';
  import SampleTimingChart from './SampleTimingChart.svelte';
  import SpurSpectrum from './SpurSpectrum.svelte';

  let m = $state(4);
  let sampleRateGHz = $state(10);
  let inputGHz = $state(1);
  let gainPct = $state(0.3);
  let offsetMv = $state(1);
  let skewPs = $state(0.1);
  let bandwidthPct = $state(2);
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
  const inputMinGHz = $derived(Math.max(0.001, sampleRateGHz / N));
  const inputMaxGHz = $derived(sampleRateGHz / 2 - sampleRateGHz / N);
  const harmonics: HarmonicLevels = $derived({ 2: h2Dbc, 3: h3Dbc, 5: h5Dbc, 7: h7Dbc });

  $effect(() => {
    inputGHz = Math.max(inputMinGHz, Math.min(inputMaxGHz, inputGHz));
  });

  const mm = $derived(mismatch(m, gainPct / 100, offsetMv / 1e3, skewPs / 1e12, bandwidthPct / 100));
  const r = $derived(read(m, inputGHz * 1e9, mm, bits, 'off', { fs, jitter: jitterPs / 1e12, harmonics, decimation }));
  const seen = $derived(foldFrequency(r.fin, fs / m));
  const zone = $derived(Math.min(m, Math.floor(r.fin / (fs / (2 * m))) + 1));
  const sourceRows = $derived(contributions(mm, r.fin, fs, harmonics, jitterPs / 1e12, r.fsOut));
  const rateText = (hz: number) => freqText(hz).replace(/Hz$/, 'S/s');
</script>

<main class="page">
  <section class="workspace">
    <aside class="control-panel" aria-label="Converter and error settings">
      <div class="control-group">
        <div class="group-head">
          <span class="label">Sampling</span>
          <span>{rateText(r.fsOut)} out · {r.fftPoints} FFT points</span>
        </div>
        <EditableRange id="input-frequency" min={inputMinGHz} max={inputMaxGHz} step={0.001} digits={3} unit="GHz" bind:value={inputGHz}>Input</EditableRange>
        <EditableRange id="sample-rate" min={0.5} max={10} step={0.1} digits={1} unit="GS/s" bind:value={sampleRateGHz}>Sample rate</EditableRange>
        <div class="channel-row">
          <span>Channels</span>
          <Segmented size="sm" mono label="Number of channels" options={CHANNELS.map((c) => ({ value: c, label: String(c) }))} bind:value={m} />
        </div>
        <EditableRange id="bits" min={8} max={16} step={1} digits={0} unit="bits" bind:value={bits}>Resolution</EditableRange>
        <EditableRange id="decimation" min={1} max={255} step={1} digits={0} unit="" prefix="÷" bind:value={decimation}>Decimation</EditableRange>
        <div class="sampling-readout">
          <span>actual input <b>{freqText(r.fin)}</b></span>
          <span>each channel {rateText(fs / m)} · sees {freqText(seen)}</span>
          <span>channel Nyquist zone {zone} of {m}</span>
        </div>
      </div>

      <div class="control-group accent2">
        <div class="group-head"><span class="label">Channel mismatch · rms</span></div>
        <EditableRange id="offset" min={0} max={8} step={0.1} digits={1} unit="mV" bind:value={offsetMv}>Offset</EditableRange>
        <EditableRange id="gain" min={0} max={3} step={0.05} digits={2} unit="%" bind:value={gainPct}>Gain</EditableRange>
        <EditableRange id="skew" min={0} max={2} step={0.01} digits={2} unit="ps" bind:value={skewPs}>Skew</EditableRange>
        <EditableRange id="bandwidth" min={0} max={10} step={0.1} digits={1} unit="%" bind:value={bandwidthPct}>Bandwidth</EditableRange>
      </div>

      <div class="control-group source">
        <div class="group-head"><span class="label">Clock &amp; source</span></div>
        <EditableRange id="jitter" min={0} max={5} step={0.05} digits={2} unit="ps" bind:value={jitterPs}>Jitter</EditableRange>
        <EditableRange id="h2" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h2Dbc}>H2</EditableRange>
        <EditableRange id="h3" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h3Dbc}>H3</EditableRange>
        <EditableRange id="h5" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h5Dbc}>H5</EditableRange>
        <EditableRange id="h7" min={-100} max={-40} step={1} digits={0} unit="dBc" bind:value={h7Dbc}>H7</EditableRange>
      </div>
    </aside>

    <section class="visuals" aria-label="Time and frequency views">
      <div class="chart time-chart">
        <div class="cap">
          <span class="left"><span class="label">Time domain</span><span>{freqText(r.fin)} input · four channel turns shown</span></span>
        </div>
        <SampleTimingChart samples={r.rawData} truth={r.truth} fin={r.fin} {fs} {harmonics} hover={hoverSample} onhover={(i) => (hoverSample = i)} label="Time-domain input and interleaved channel samples" />
      </div>

      <div class="chart spectrum-chart">
        <div class="cap">
          <span class="left"><span class="label">Output spectrum</span><span>{r.fftPoints}-point FFT · {rateText(r.fsOut)} · {r.coherent ? 'rectangular' : 'Blackman–Harris'}</span></span>
          <span title={r.metricsResolved ? (r.coherent ? 'Coherent FFT estimates' : 'SNDR: known-frequency sine fit. SFDR: strongest windowed residual lobe. Closely spaced tones may not resolve.') : 'Noncoherent record has fewer than 64 points, or the carrier is within five bins of DC / Nyquist'}>SFDR <b>{r.metricsResolved ? nf(r.raw.sfdr, 1) : '—'} dB</b> · SNDR <b>{r.metricsResolved ? nf(r.raw.sndr, 1) : '—'} dB</b></span>
        </div>
        <SpurSpectrum spectrum={r.raw} spurs={r.spurs} harmonics={r.harmonics} {bits} fs={r.fsOut} points={r.fftPoints} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Spectrum of the interleaved and decimated output" />
      </div>

      <div class="chart contribution-chart">
        <div class="cap">
          <span class="left"><span class="label">Where each imperfection appears</span><span>same frequency axis as the FFT above</span></span>
        </div>
        <ContributionMap rows={sourceRows} fs={r.fsOut} points={r.fftPoints} label="Spectral signature of offset, gain, timing, bandwidth, harmonics, and jitter" />
      </div>
    </section>
  </section>
</main>

<style>
  .page { height: calc(100dvh - 103px); min-height: 0; grid-template-rows: minmax(0, 1fr); max-width: 1600px; padding-block: 10px 8px; gap: 0; }
  .workspace { min-width: 0; min-height: 0; display: grid; grid-template-columns: minmax(330px, 380px) minmax(0, 1fr); gap: 26px; align-items: stretch; }
  .control-panel { min-width: 0; min-height: 0; display: grid; gap: 8px; align-content: start; }
  .control-group { min-width: 0; display: grid; gap: 4px; padding: 8px 12px; border: 1px solid var(--rule); border-radius: 5px; }
  .group-head { min-height: 19px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--ink-3); font-size: 11.5px; }
  .group-head > :last-child { text-align: right; }
  .channel-row { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 27px; color: var(--ink-2); font-size: 12.5px; }
  .channel-row :global(.segmented) { width: 100%; }
  .sampling-readout { display: grid; gap: 2px; padding-top: 5px; border-top: 1px solid var(--rule); color: var(--ink-3); font-size: 11.5px; }
  .sampling-readout b { color: var(--ink); font: 500 11.5px var(--mono); }
  .source { --accent: var(--s1); }
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
    .control-group:first-child { grid-row: span 2; }
    .visuals { grid-template-rows: 300px 320px 270px; }
  }
  @media (max-width: 700px) {
    .control-panel { grid-template-columns: minmax(0, 1fr); }
    .control-group:first-child { grid-row: auto; }
    .visuals { grid-template-rows: 280px 300px 260px; }
  }
  @media (min-width: 901px) and (max-height: 700px) {
    .page { height: auto; min-height: 600px; }
    .workspace { align-items: start; }
    .visuals { grid-template-rows: 180px 230px 170px; }
  }
</style>

<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { freqText, nf } from '../../lib/format';
  import { foldFrequency } from '../../lib/frequency';
  import { clamp } from '../../lib/scale';
  import ContributionMap from './ContributionMap.svelte';
  import FinRuler from './FinRuler.svelte';
  import { CHANNELS, contributions, mismatch, N, read, residualRms, type HarmonicLevels } from './model';
  import SampleTimingChart from './SampleTimingChart.svelte';
  import SpurSpectrum from './SpurSpectrum.svelte';

  let m = $state(4);
  let sampleRateGHz = $state(1);
  let target = $state(100e6);
  let gainPct = $state(0.3);
  let offsetMv = $state(1);
  let skewPs = $state(5);
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
  const harmonics: HarmonicLevels = $derived({ 2: h2Dbc, 3: h3Dbc, 5: h5Dbc, 7: h7Dbc });
  $effect(() => {
    const high = fs / 2 - fs / N;
    if (target > high) target = high;
  });

  const mm = $derived(mismatch(m, gainPct / 100, offsetMv / 1e3, skewPs / 1e12, bandwidthPct / 100));
  const r = $derived(read(m, target, mm, bits, 'off', { fs, jitter: jitterPs / 1e12, harmonics, decimation }));
  const seen = $derived(foldFrequency(r.fin, fs / m));
  const zone = $derived(Math.min(m, Math.floor(r.fin / (fs / (2 * m))) + 1));
  const error = $derived(residualRms(r.rawData, r.fin, r.rawData.length, fs, harmonics) * 1e3);
  const sourceRows = $derived(contributions(mm, r.fin, fs, harmonics, jitterPs / 1e12, r.fsOut));

  const setTarget = (hz: number) => (target = clamp(hz, Math.max(1e6, fs / N), fs / 2 - fs / N));
  const rateText = (hz: number) => freqText(hz).replace(/Hz$/, 'S/s');
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Time-interleaved ADCs</h1>
    <p class="sub">Slower converters take turns; every repeating channel difference leaves a distinct spectral signature.</p>
    <div class="model-notes">
      <Notes>
        <p><b>Taking turns.</b> <var>M</var> converters, each running at <var>f</var><sub>s</sub>/<var>M</var>, fill the sample slots of one converter at <var>f</var><sub>s</sub>. Any channel-to-channel difference repeats every <var>M</var> samples, so it creates tones or images spaced by <var>f</var><sub>s</sub>/<var>M</var>.</p>
        <p><b>Each error has a signature.</b> Offset creates fixed tones at multiples of <var>f</var><sub>s</sub>/<var>M</var>. Gain, timing skew, and bandwidth mismatch create shifted copies of the input around those multiples. Timing error grows with input frequency; bandwidth error contributes both gain and phase error.</p>
        <p><b>Jitter and harmonics look different.</b> Random aperture jitter spreads energy into a broadband floor. H2, H3, H5, and H7 remain discrete tones and each has an independent level.</p>
        <p><b>Bandwidth model.</b> Every channel has a one-pole input response whose nominal corner is <var>f</var><sub>s</sub>/2. The bandwidth control spreads those corners about their mean; the common roll-off is divided out so the page shows only mismatch.</p>
        <p><b>Decimation.</b> The converter always captures {N} samples. Keeping every Dth sample uses no anti-alias filter here, so every tone and mismatch image folds again into the output Nyquist band. The output FFT contains ⌈{N}/D⌉ points.</p>
      </Notes>
    </div>
  </header>

  <section class="tuner" aria-label="Input frequency">
    <div class="tuner-left">
      <label class="label" for="fin">Input</label>
      <ValueField id="fin" value={r.fin / 1e6} digits={3} unit="MHz" step={1} onchange={(v) => setTarget(v * 1e6)} title="Type a frequency in MHz, or use ↑ ↓ to step 1 MHz (Shift: 10 MHz)" />
      <div class="legend">
        <span>each channel samples at <b class="mono">{rateText(fs / m)}</b> and sees the tone at <b class="mono">{freqText(seen)}</b></span>
        <span>channel Nyquist zone <b class="mono">{zone}</b> of {m}</span>
      </div>
    </div>
    <FinRuler f={r.fin} {fs} {m} onchange={setTarget} />
  </section>

  <section class="controls" aria-label="Converter and error settings">
    <div class="control-card converter">
      <div class="card-head"><span class="label">Sampling</span><span class="card-meta">output {rateText(r.fsOut)} · FFT {r.fftPoints} points</span></div>
      <div class="channel-row"><span>Channels</span><Segmented size="sm" mono label="Number of channels" options={CHANNELS.map((c) => ({ value: c, label: String(c) }))} bind:value={m} /></div>
      <Range id="sample-rate" min={0.5} max={10} step={0.1} output="{nf(sampleRateGHz, 1)} GS/s" bind:value={sampleRateGHz}>Sample rate</Range>
      <Range id="bits" min={8} max={16} step={1} output="{bits} bits" bind:value={bits}>Resolution</Range>
      <Range id="decimation" min={1} max={255} step={1} output="÷{decimation}" bind:value={decimation}>Decimation</Range>
    </div>
    <div class="control-card accent2">
      <div class="card-head"><span class="label">Channel mismatch · rms</span></div>
      <Range id="offset" min={0} max={8} step={0.1} output="{nf(offsetMv, 1)} mV" bind:value={offsetMv}>Offset</Range>
      <Range id="gain" min={0} max={3} step={0.05} output="{nf(gainPct, 2)} %" bind:value={gainPct}>Gain</Range>
      <Range id="skew" min={0} max={10} step={0.1} output="{nf(skewPs, 1)} ps" bind:value={skewPs}>Skew</Range>
      <Range id="bandwidth" min={0} max={10} step={0.1} output="{nf(bandwidthPct, 1)} %" bind:value={bandwidthPct}>Bandwidth</Range>
    </div>
    <div class="control-card source">
      <div class="card-head"><span class="label">Clock &amp; source</span></div>
      <Range id="jitter" min={0} max={5} step={0.05} output="{nf(jitterPs, 2)} ps" bind:value={jitterPs}>Jitter</Range>
      <Range id="h2" min={-100} max={-40} step={1} output={h2Dbc <= -100 ? 'off' : `${nf(h2Dbc, 0)} dBc`} bind:value={h2Dbc}>H2</Range>
      <Range id="h3" min={-100} max={-40} step={1} output={h3Dbc <= -100 ? 'off' : `${nf(h3Dbc, 0)} dBc`} bind:value={h3Dbc}>H3</Range>
      <Range id="h5" min={-100} max={-40} step={1} output={h5Dbc <= -100 ? 'off' : `${nf(h5Dbc, 0)} dBc`} bind:value={h5Dbc}>H5</Range>
      <Range id="h7" min={-100} max={-40} step={1} output={h7Dbc <= -100 ? 'off' : `${nf(h7Dbc, 0)} dBc`} bind:value={h7Dbc}>H7</Range>
    </div>
  </section>

  <section class="compare">
    <div class="frequency-stack">
      <div class="chart">
        <div class="cap">
          <span class="left"><span class="label">Output spectrum</span><span>{r.fftPoints}-point FFT · {rateText(r.fsOut)}</span></span>
          <span>SFDR <b>{nf(r.raw.sfdr, 1)} dB</b> · SNDR <b>{nf(r.raw.sndr, 1)} dB</b></span>
        </div>
        <SpurSpectrum spectrum={r.raw} spurs={r.spurs} harmonics={r.harmonics} {bits} fs={r.fsOut} points={r.fftPoints} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Spectrum of the interleaved and decimated output" />
      </div>

      <div class="chart contribution-chart">
        <div class="cap">
          <span class="left"><span class="label">Where each imperfection appears</span><span>same frequency axis as the FFT above</span></span>
          <span><span class="sym">○ □</span> tones · band = jitter</span>
        </div>
        <ContributionMap rows={sourceRows} fs={r.fsOut} points={r.fftPoints} label="Spectral signature of offset, gain, timing, bandwidth, harmonics, and jitter" />
      </div>
    </div>

    <div class="chart sample-chart">
      <div class="cap">
        <span class="left"><span class="label">Samples from the channel bank</span><span>marker position includes fixed timing skew</span></span>
        <span>error rms <b>{nf(error, 2)} mV</b></span>
      </div>
      <SampleTimingChart samples={r.rawData} truth={r.truth} fin={r.fin} {fs} {harmonics} hover={hoverSample} onhover={(i) => (hoverSample = i)} label="Time-domain input, interleaved channel samples, and sample error" />
    </div>
  </section>
</main>

<style>
  .page { height: auto; grid-template-rows: auto auto auto minmax(540px, 1fr); min-height: calc(100dvh - 49px); }
  .model-notes { margin-left: auto; }
  .tuner { border-top: 1px solid var(--rule); padding-top: 8px; }
  .legend b { font-weight: 500; color: var(--ink); }
  .controls { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
  .control-card { min-width: 0; display: grid; gap: 7px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 4px; }
  .card-head { min-height: 18px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; color: var(--ink-3); }
  .card-meta { color: var(--ink-2); font: 12px var(--mono); white-space: nowrap; }
  .channel-row { display: grid; grid-template-columns: 84px minmax(0, 1fr); align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); }
  .control-card :global(.range) { display: grid; grid-template-columns: 84px minmax(72px, 1fr) 8.5ch; gap: 8px; --range-width: 100%; --range-output-width: 8.5ch; }
  .source { --accent: var(--s1); }
  .sym { color: var(--ink-3); font-family: var(--mono); }
  .compare { --rows: minmax(540px, 1fr); }
  .frequency-stack { min-width: 0; min-height: 0; display: grid; grid-template-rows: minmax(290px, 1.15fr) minmax(230px, .85fr); gap: 12px; }
  .sample-chart { min-width: 0; }
  @media (min-width: 901px) {
    .tuner { grid-template-columns: 430px minmax(0, 1fr); }
    .tuner-left { min-width: 0; }
  }
  @media (max-width: 1120px) and (min-width: 701px) {
    .controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .source { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .source .card-head { grid-column: 1 / -1; }
  }
  @media (max-width: 900px) {
    .model-notes { margin-left: 0; }
    .compare { min-height: 0; }
    .frequency-stack { grid-template-rows: 300px 260px; }
    .sample-chart { height: 320px; }
  }
  @media (max-width: 700px) {
    .controls { grid-template-columns: minmax(0, 1fr); }
    .source { grid-column: auto; display: grid; }
    .source .card-head { grid-column: auto; }
    .control-card :global(.range) { grid-template-columns: 76px minmax(70px, 1fr) 8.5ch; }
  }
</style>

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
  import { CHANNELS, contributions, mismatch, N, read, residualRms } from './model';
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
  let harmonicDbc = $state(-65);
  let bits = $state(12);
  let hoverBin = $state<number | null>(null);
  let hoverSample = $state<number | null>(null);

  const fs = $derived(sampleRateGHz * 1e9);
  $effect(() => {
    const high = fs / 2 - fs / N;
    if (target > high) target = high;
  });

  const mm = $derived(mismatch(m, gainPct / 100, offsetMv / 1e3, skewPs / 1e12, bandwidthPct / 100));
  const r = $derived(read(m, target, mm, bits, 'off', { fs, jitter: jitterPs / 1e12, harmonicDbc }));
  const seen = $derived(foldFrequency(r.fin, fs / m));
  const zone = $derived(Math.min(m, Math.floor(r.fin / (fs / (2 * m))) + 1));
  const error = $derived(residualRms(r.rawData, r.fin, r.rawData.length, fs, harmonicDbc) * 1e3);
  const sourceRows = $derived(contributions(mm, r.fin, fs, harmonicDbc, jitterPs / 1e12));

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
        <p><b>Jitter and harmonics look different.</b> Random aperture jitter spreads energy into a broadband floor with the familiar limit −20 log₁₀(2π<var>f</var><sub>in</sub>σ<sub>t</sub>). H2 and H3 remain discrete tones, folded into the first Nyquist band after sampling.</p>
        <p><b>Bandwidth model.</b> Every channel has a one-pole input response whose nominal corner is <var>f</var><sub>s</sub>/2. The bandwidth control spreads those corners about their mean; the common roll-off is divided out so the page shows only mismatch.</p>
        <p><b>The record.</b> {N} samples, a 0.4 V tone on a ±0.5 V range, 0.3 LSB of thermal noise, and one quantiser per sample. The sample rate is adjustable from 0.5 to 10 GS/s. The fixed channel patterns stay the same while the sliders scale their RMS values.</p>
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
    <div class="group converter">
      <span class="label">Converter</span>
      <Segmented size="sm" mono label="Number of channels" options={CHANNELS.map((c) => ({ value: c, label: String(c) }))} bind:value={m} />
      <Range id="sample-rate" min={0.5} max={10} step={0.1} output="{nf(sampleRateGHz, 1)} GS/s" bind:value={sampleRateGHz}>Sample rate</Range>
      <Range id="bits" min={8} max={16} step={1} output="{bits} bits" bind:value={bits}>Resolution</Range>
    </div>
    <div class="group accent2">
      <span class="label">Channel mismatch, rms</span>
      <Range id="offset" min={0} max={8} step={0.1} output="{nf(offsetMv, 1)} mV" bind:value={offsetMv}>Offset</Range>
      <Range id="gain" min={0} max={3} step={0.05} output="{nf(gainPct, 2)} %" bind:value={gainPct}>Gain</Range>
      <Range id="skew" min={0} max={10} step={0.1} output="{nf(skewPs, 1)} ps" bind:value={skewPs}>Skew</Range>
      <Range id="bandwidth" min={0} max={10} step={0.1} output="{nf(bandwidthPct, 1)} %" bind:value={bandwidthPct}>Bandwidth</Range>
    </div>
    <div class="group source">
      <span class="label">Clock &amp; source</span>
      <Range id="jitter" min={0} max={5} step={0.05} output="{nf(jitterPs, 2)} ps" bind:value={jitterPs}>Jitter</Range>
      <Range id="harmonics" min={-100} max={-30} step={1} output={harmonicDbc <= -100 ? 'off' : `${nf(harmonicDbc, 0)} dBc`} bind:value={harmonicDbc}>H2 · H3 −6 dB</Range>
    </div>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Output spectrum</span><span><span class="sym">○ □</span> expected images and offset tones</span></span>
        <span>SFDR <b>{nf(r.raw.sfdr, 1)} dB</b> · SNDR <b>{nf(r.raw.sndr, 1)} dB</b></span>
      </div>
      <SpurSpectrum spectrum={r.raw} spurs={r.spurs} {bits} {fs} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Spectrum of the interleaved output with expected mismatch spurs" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Samples from the channel bank</span><span>marker position includes fixed timing skew</span></span>
        <span>error rms <b>{nf(error, 2)} mV</b></span>
      </div>
      <SampleTimingChart samples={r.rawData} truth={r.truth} fin={r.fin} {fs} {harmonicDbc} hover={hoverSample} onhover={(i) => (hoverSample = i)} label="Time-domain input, interleaved channel samples, and sample error" />
    </div>

    <div class="chart wide">
      <div class="cap">
        <span class="left"><span class="label">What each imperfection creates</span><span>positions across the first Nyquist band</span></span>
        <span>markers are tones · the band is jitter</span>
      </div>
      <ContributionMap rows={sourceRows} {fs} label="Spectral signature of offset, gain, timing, bandwidth, harmonics, and jitter" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); min-height: 760px; }
  .model-notes { margin-left: auto; }
  .tuner { border-top: 1px solid var(--rule); padding-top: 8px; }
  .legend b { font-weight: 500; color: var(--ink); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 30px; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
  .group .label { color: var(--ink-3); }
  .controls :global(.range) { --range-width: 78px; --range-output-width: 8ch; }
  .source { --accent: var(--s1); }
  .sym { color: var(--ink-3); font-family: var(--mono); }
  .compare { --rows: minmax(0, 1fr) minmax(190px, .9fr); }
  .wide { grid-column: 1 / -1; }
  @media (min-width: 901px) {
    .tuner { grid-template-columns: 430px minmax(0, 1fr); }
    .tuner-left { min-width: 0; }
  }
  @media (max-width: 900px) {
    .model-notes { margin-left: 0; }
    .controls, .group { width: 100%; min-width: 0; }
    .wide { grid-column: auto; }
  }
</style>

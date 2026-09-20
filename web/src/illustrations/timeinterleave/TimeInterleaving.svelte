<script lang="ts">
  import { untrack } from 'svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { freqText, nf } from '../../lib/format';
  import { foldFrequency, residual } from '../../lib/frequency';
  import { clamp } from '../../lib/scale';
  import ChannelPlane from './ChannelPlane.svelte';
  import FinRuler from './FinRuler.svelte';
  import { CHANNELS, channelNyquist, FS, mismatch, N, read, residualRms, sweep, type Method, type Sweep } from './model';
  import SampleTimingChart from './SampleTimingChart.svelte';
  import SpurSpectrum from './SpurSpectrum.svelte';
  import SweepChart from './SweepChart.svelte';

  const METHODS: { value: Method; label: string }[] = [
    { value: 'off', label: 'Off' },
    { value: 'fft', label: 'FFT delay' },
    { value: 'farrow', label: 'Farrow delay' },
  ];

  // exp_ti01's four channels, with the three mismatches about as loud as each other near 100 MHz
  let method = $state<Method>('off');
  let m = $state(4);
  let target = $state(100e6);
  let gainPct = $state(0.3);
  let offsetMv = $state(1);
  let skewPs = $state(5);
  let bits = $state(12);
  let hoverBin = $state<number | null>(null);
  let hoverChannel = $state<number | null>(null);
  let hoverSweep = $state<number | null>(null);
  let hoverSample = $state<number | null>(null);

  const mm = $derived(mismatch(m, gainPct / 100, offsetMv / 1e3, skewPs / 1e12));
  const r = $derived(read(m, target, mm, bits, method));
  const nyquist = $derived(channelNyquist(m));
  const seen = $derived(foldFrequency(r.fin, FS / m));
  const zone = $derived(Math.floor(r.fin / nyquist) + 1);
  const worst = $derived(r.spurs.reduce((a, b) => (b.dbc > a.dbc ? b : a)));
  const rawResidual = $derived(residualRms(r.rawData, r.fin) * 1e3);
  const outResidual = $derived(residualRms(r.outData, r.fin) * 1e3);

  // the sweep takes a few dozen milliseconds: run it once the controls rest, and show the last one faded meanwhile
  let swept = $state<Sweep | null>(null);
  let sweptFor = $state('');
  const key = $derived(`${m} ${gainPct} ${offsetMv} ${skewPs} ${bits}`);
  $effect(() => {
    const [channels, pattern, resolution, now] = [m, mm, bits, key];
    const id = setTimeout(() => {
      swept = sweep(channels, pattern, resolution);
      sweptFor = now;
    }, untrack(() => swept) ? 120 : 0);
    return () => clearTimeout(id);
  });

  const setTarget = (hz: number) => (target = clamp(hz, 1e6, FS / 2 - 1e6));
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Time-interleaved ADCs</h1>
    <p class="sub">Slower converters taking turns: whatever differs between them becomes a spur, and one sine can measure it away.</p>
    <div class="pick">
      <span class="label">Calibration</span>
      <Segmented size="sm" label="Foreground calibration" options={METHODS} bind:value={method} />
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>timeinterleave/</code>: <a href="/doc/api/timeinterleave#adctoolbox.deinterleave"><code>deinterleave</code></a>, <a href="/doc/api/timeinterleave#adctoolbox.interleave"><code>interleave</code></a>, <a href="/doc/api/timeinterleave#adctoolbox.extract_mismatch_sine"><code>extract_mismatch_sine</code></a>, <a href="/doc/api/timeinterleave#adctoolbox.predict_spurs"><code>predict_spurs</code></a>, <a href="/doc/api/timeinterleave#adctoolbox.calibrate_foreground"><code>calibrate_foreground</code></a>, <a href="/doc/api/timeinterleave#adctoolbox.fractional_delay_fft"><code>fractional_delay_fft</code></a>, <a href="/doc/api/timeinterleave#adctoolbox.fractional_delay_farrow"><code>fractional_delay_farrow</code></a>. <code>siggen/</code>: <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_quantization_noise"><code>apply_quantization_noise</code></a>. <code>spectrum/</code>: <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a>. This page is the interactive companion to its example <code>exp_ti01</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_time_interleave.py">python/adc_time_interleave.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same samples and every number here matches it.</p>
      <p><b>Taking turns.</b> <var>M</var> converters, each at <var>f</var><sub>s</sub>/<var>M</var>, fill every slot of one at <var>f</var><sub>s</sub>. None is quite like the others: each adds its own offset, has its own gain, and samples a few picoseconds early or late. The pattern repeats every <var>M</var> samples, so it can only put energy at multiples of <var>f</var><sub>s</sub>/<var>M</var>: the offsets as tones there, whatever the input, and gain and skew as images of the input, <var>f</var><sub>in</sub> + <var>k</var>·<var>f</var><sub>s</sub>/<var>M</var>, folded.</p>
      <p><b>Gain and skew are one number.</b> Sampling <var>t</var> late turns the tone's phase by 2π·<var>f</var><sub>in</sub>·<var>t</var>, so a channel's skew and gain together are a complex gain, <var>g</var>·e<sup><var>j</var>2π<var>f</var><sub>in</sub><var>t</var></sup>. <code>predict_spurs</code> takes the <var>M</var>-point DFT of those gains, less their mean, for the images, and of the offsets for the tones. Gain spreads the points sideways and stays put; skew spreads them upwards, further the higher the input, and its images rise 6 dB for every doubling of <var>f</var><sub>in</sub>. An offset pattern is real, so its coefficients <var>k</var> and <var>M</var> − <var>k</var> land on the same frequency as one tone, which <code>predict_spurs</code> reports once, at twice either one's size.</p>
      <p><b>Measuring it.</b> <code>extract_mismatch_sine</code> splits the record into its channels, takes each one's mean as its offset, and the phasor of its samples at the known tone, each at its own time, as its gain and skew. A coherent tone makes that exact up to the noise and the quantiser, which are what the rings and dots still disagree by.</p>
      <p><b>Taking it out.</b> <code>calibrate_foreground</code> subtracts each offset, divides by each gain, and delays each channel by its skew at <var>f</var><sub>s</sub>/<var>M</var>: by turning the phase of every FFT bin, or with a nine-tap Lagrange interpolator, the Farrow delay, which is causal and cheap but loses accuracy fast as the tone nears <var>f</var><sub>s</sub>/2<var>M</var>, and at the ends of the record.</p>
      <p><b>Where it stops.</b> Each channel sees the input folded to its own Nyquist frequency, <var>f</var><sub>s</sub>/2<var>M</var>, and a delay turns the phase of the frequency the channel sees. Above <var>f</var><sub>s</sub>/2<var>M</var> that is not the input: the correction falls short by the nearest multiple of <var>f</var><sub>s</sub>/<var>M</var>, and the images stay, as if the input sat on that multiple, sometimes bigger than before. Offset and gain are corrected at any frequency.</p>
      <p><b>The record.</b> {N} samples at 1 GS/s, a 0.4 V tone on ±0.5 V, 0.3 LSB of thermal noise and a quantiser per sample, as <code>apply_thermal_noise</code> and <code>apply_quantization_noise</code> would add them. <code>exp_ti01</code> uses 16384 samples and no quantiser. The mismatches are one fixed random pattern per quantity, scaled to the rms you set. The sweep repeats the capture, extraction and both calibrations at 40 frequencies.</p>
    </Notes>
  </header>

  <section class="tuner" aria-label="Input frequency">
    <div class="tuner-left">
      <label class="label" for="fin">Input</label>
      <ValueField id="fin" value={r.fin / 1e6} digits={3} unit="MHz" step={1} onchange={(v) => setTarget(v * 1e6)} title="Type a frequency in MHz, or use ↑ ↓ to step 1 MHz (Shift: 10 MHz)" />
      <div class="legend">
        <span>each channel samples at <b class="mono">{FS / m / 1e6} MS/s</b> and sees it at <b class="mono">{freqText(seen)}</b>{residual(r.fin, FS / m) < 0 ? ', mirrored' : ''}</span>
        <span>{zone === 1 ? 'in its first zone: the delays can correct the skew' : `in its zone ${zone}: the delays turn the wrong frequency`}</span>
      </div>
    </div>
    <FinRuler f={r.fin} {m} onchange={setTarget} />
  </section>

  <section class="controls" aria-label="The channels">
    <div class="group">
      <span class="label">Channels</span>
      <Segmented size="sm" mono label="Number of channels" options={CHANNELS.map((c) => ({ value: c, label: String(c) }))} bind:value={m} />
      <Range id="bits" min={8} max={16} step={1} output="{bits} bits" bind:value={bits}>Resolution</Range>
    </div>
    <div class="group accent2">
      <span class="label">Mismatch, rms</span>
      <Range id="offset" min={0} max={8} step={0.1} output="{nf(offsetMv, 1)} mV" bind:value={offsetMv}>Offset</Range>
      <Range id="gain" min={0} max={3} step={0.05} output="{nf(gainPct, 2)} %" bind:value={gainPct}>Gain</Range>
      <Range id="skew" min={0} max={10} step={0.1} output="{nf(skewPs, 1)} ps" bind:value={skewPs}>Skew</Range>
    </div>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Spectrum</span><span>{method === 'off' ? 'of the interleaved output' : 'after calibration, the raw one in grey'}; <span class="sym">○ □</span> where predict_spurs expects images and offset tones</span></span>
        <span>SFDR <b>{nf(r.out.sfdr, 1)} dB</b> · SNDR <b>{nf(r.out.sndr, 1)} dB</b>{method !== 'off' ? ` · raw ${nf(r.raw.sfdr, 1)}, ${nf(r.raw.sndr, 1)} dB` : ''}</span>
      </div>
      <SpurSpectrum spectrum={r.out} ghost={method === 'off' ? null : r.raw} spurs={r.spurs} {bits} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Spectrum of the interleaved output with the predicted spurs" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Samples from the channel bank</span><span>marker position includes each channel's timing skew</span></span>
        <span>error rms <b>{nf(outResidual, 2)} mV</b>{method !== 'off' ? ` · raw ${nf(rawResidual, 2)} mV` : ''}</span>
      </div>
      <SampleTimingChart raw={r.rawData} corrected={r.outData} truth={r.truth} fin={r.fin} {method} hover={hoverSample} onhover={(i) => (hoverSample = i)} label="Time-domain samples from each interleaved channel and the residual before and after calibration" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Each channel</span><span>set <span class="sym">○</span>, measured <span class="sym s2">●</span>{method !== 'off' ? ', left after calibration' : ''}{#if method !== 'off'} <span class="sym s1">●</span>{/if}</span></span>
        <span>largest spur <b>{nf(worst.dbc, 1)} dBc</b>, {worst.kind === 'offset' ? 'offset' : 'image'} k={worst.k}</span>
      </div>
      <ChannelPlane truth={r.truth} measured={r.measured} left={r.left} hover={hoverChannel} onhover={(c) => (hoverChannel = c)} label="Each channel's gain and skew as a complex gain, and its offset" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">SFDR against input</span><span><span class="sym s2">—</span> raw <span class="sym s2">┈</span> predicted <span class="sym s1">—</span> FFT <span class="sym s1">- -</span> Farrow</span></span>
        <span>delays hold below <b>{freqText(nyquist)}</b></span>
      </div>
      {#if swept}
        <SweepChart sweep={swept} stale={sweptFor !== key} at={r.fin} {nyquist} {method} hover={hoverSweep} onhover={(i) => (hoverSweep = i)} label="SFDR against input frequency, raw, predicted and after each calibration" />
      {:else}
        <div class="wait">sweeping 40 input frequencies…</div>
      {/if}
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .tuner { border-top: 1px solid var(--rule); padding-top: 8px; }
  .legend b { font-weight: 500; color: var(--ink); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 30px; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; }
  .group .label { color: var(--ink-3); }
  .controls :global(.range) { --range-width: 92px; }
  .controls :global(output) { min-width: 6ch; }
  .sym { color: var(--ink-3); font-family: var(--mono); }
  .s1 { color: var(--s1); }
  .s2 { color: var(--s2); }
  .wait { flex: 1 1 auto; display: grid; place-items: center; color: var(--ink-3); font-size: 13px; }
  .compare { --rows: repeat(2, minmax(0, 1fr)); }
  @media (min-width: 901px) {
    .tuner { grid-template-columns: 430px minmax(0, 1fr); }
    .tuner-left { min-width: 0; }
  }
</style>

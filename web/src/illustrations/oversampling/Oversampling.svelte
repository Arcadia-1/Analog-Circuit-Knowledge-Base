<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, nf } from '../../lib/format';
  import BandChart from './BandChart.svelte';
  import { floorModel, FS, N, noiseBudget, OSRS, read, rms, TONE } from './model';
  import NoiseBudgetChart from './NoiseBudgetChart.svelte';
  import NoiseSpectrum from './NoiseSpectrum.svelte';
  import OsrChart from './OsrChart.svelte';

  const SHAPES = [
    { value: 0, label: 'None' },
    { value: 1, label: '1st order' },
    { value: 2, label: '2nd order' },
    { value: 3, label: '3rd order' },
  ];
  const CHOICES = OSRS.filter((o) => o > 1 && o < 256);
  // a period and a half of the tone
  const COUNT = Math.round((1.5 * N) / TONE.bin);

  // a 4-bit quantiser, shaped to second order and read at exp_o01's OSR of 32: fourteen effective bits out of four
  let order = $state(2);
  let osr = $state(32);
  let bits = $state(4);
  let whiteNoiseLsb = $state(0);
  let hoverBin = $state<number | null>(null);
  let hoverOsr = $state<number | null>(null);
  let hoverT = $state<number | null>(null);
  let hoverBudget = $state<number | null>(null);

  const r = $derived(read(order, bits, osr, whiteNoiseLsb));
  const at = $derived(OSRS.indexOf(osr));
  const outside = $derived(rms(r.data.map((v, i) => v - r.inband[i])));
  const theory = $derived(floorModel(bits, order, whiteNoiseLsb));
  const budget = $derived(noiseBudget(order, bits, whiteNoiseLsb));
  const edge = $derived(Math.max(1, Math.floor(N / (2 * osr))));
  const retainedDb = $derived(budget.cumulativeDb[edge - 1]);
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Oversampling and noise shaping</h1>
    <p class="sub">Only the band's share of the quantisation noise counts, and shaping can push most of it out.</p>
    <div class="pick">
      <span class="label">Shaping</span>
      <Segmented size="sm" label="Noise-shaping order" options={SHAPES} bind:value={order} />
    </div>
    <Notes>
      <p><b>Checked with ADCToolbox.</b> <code>oversampling/</code>: <a href="/doc/api/oversampling#adctoolbox.oversampling.ntfperf"><code>ntfperf</code></a>, <a href="/doc/api/oversampling#adctoolbox.oversampling.perfosr"><code>perfosr</code></a>, <a href="/doc/api/oversampling#adctoolbox.oversampling.ifilter"><code>ifilter</code></a>. <code>spectrum/</code>: <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a>. <code>fundamentals/</code>: <a href="/doc/api/fundamentals#adctoolbox.fit_sine_4param"><code>fit_sine_4param</code></a>. This page follows examples <code>exp_o01</code>, <code>exp_o02</code> and <code>exp_o03</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_oversampling.py">python/adc_oversampling.py</a> builds the same record, runs the ADCToolbox analysis and pins every number shown here.</p>
      <p><b>Oversampling.</b> A converter sampling at <var>f</var><sub>s</sub> spreads its quantisation noise from 0 to <var>f</var><sub>s</sub>/2. If the signal needs only 0 to <var>f</var><sub>s</sub>/2·OSR, a filter can drop the rest and with it all but 1/OSR of the noise: 3 dB for every doubling of OSR. That is the slope with no shaping.</p>
      <p><b>Noise shaping.</b> The model starts with stationary white quantisation noise of variance LSB²/12 and passes it through NTF(<var>z</var>) = (1 − <var>z</var><sup>−1</sup>)<sup><var>L</var></sup> before adding it to the sine: zero at DC, rising as (2 sin π<var>f</var>)<sup><var>L</var></sup>, a straight line of 20<var>L</var> dB a decade on the log axis. The total noise gets worse, two, six and twenty times for <var>L</var> = 1, 2, 3, but what stays in the band collapses, and each doubling of OSR now buys 6<var>L</var> + 3 dB.</p>
      <p><b>Why the spectrum looks like noise.</b> A clean coherent sine through an undithered low-resolution quantiser produces periodic error and therefore a comb of harmonics. That is real, but it hides the noise-transfer-function slope. This lesson uses the standard linearised, dither-equivalent model and a circular NTF filter, so the record is stationary and the FFT has no false low-frequency floor from filter startup. It explains the expected noise power; a real modulator can add idle tones, overload and stability limits.</p>
      <p><b>Added white noise.</b> The slider adds independent, unshaped wideband noise after the NTF, in rms LSB. Oversampling still removes all but roughly 1/OSR of its power, but noise shaping cannot push it away from DC. Turn it up to see a flat floor take over from the sloped quantisation noise and limit the achievable SNDR.</p>
      <p><b>Two ways to count it.</b> <code>perfosr</code> fits the sine, windows the residual and adds up its spectrum to <var>f</var><sub>s</sub>/2·OSR, one OSR after another. <code>ntfperf</code> integrates |NTF|² over the same band on a million-point grid; the dashed predictions combine shaped quantisation noise of LSB²/12 with the slider's flat white-noise power. The solid and dashed curves differ because the record is finite; once the residual becomes extremely small, the numerical sine fit also sets the measured floor.</p>
      <p><b>What the band holds.</b> <code>ifilter</code> keeps the FFT bins of the band, and their mirrors, and nothing else. The grey output can look like noise with a sine somewhere in it; the band is the sine, and what the filter left outside has an rms of its own.</p>
      <p><b>A spectrum model, not a loop simulation.</b> Resolution sets the ideal LSB and hence LSB²/12. The page does not claim a particular modulator topology or stability range; use a loop-level model when overload, state swing, DAC levels or idle tones are the question.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Oversampling ratio and quantiser">
    <div class="group">
      <span class="label">OSR</span>
      <Segmented size="sm" mono label="Oversampling ratio" options={CHOICES.map((o) => ({ value: o, label: String(o) }))} bind:value={osr} />
      <span class="about">band to {freqText(FS / (2 * osr))}</span>
    </div>
    <div class="group accent2">
      <span class="label">Quantiser</span>
      <Range id="bits" min={2} max={10} step={1} output="{bits} bits" bind:value={bits}>Resolution</Range>
      <Range id="white-noise" min={0} max={1} step={0.05} output="{nf(whiteNoiseLsb, 2)} LSB rms" bind:value={whiteNoiseLsb}>White noise</Range>
    </div>
    <span class="about">{N} samples at 100 MHz · stationary quantisation noise + unshaped white noise · a {freqText(TONE.fin)} tone of 0.4 V on ±0.5 V</span>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Spectrum</span><span>on a log frequency axis; dashed, the predicted shaped + white noise floor</span></span>
        <span>in band SNDR <b>{nf(r.band.sndr, 1)} dB</b> · ENOB <b>{nf(r.band.enob, 2)}</b> · whole band {nf(r.full.sndr, 1)} dB</span>
      </div>
      <NoiseSpectrum spectrum={r.band} {theory} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Output spectrum on a logarithmic frequency axis" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">NTF and noise budget</span><span>then integrate its output from DC upward</span></span>
        <span>band contains <b>{nf(retainedDb, 1)} dB</b> of the total noise</span>
      </div>
      <NoiseBudgetChart {budget} {osr} hover={hoverBudget} onhover={(b) => (hoverBudget = b)} label="Noise transfer function and cumulative noise power from DC to each frequency" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">SNDR in the band</span><span>against OSR</span></span>
        <span>perfosr <b>{nf(r.sweep[at], 1)} dB</b> · predicted <b>{nf(r.theory[at], 1)} dB</b></span>
      </div>
      <OsrChart osrs={OSRS} sweep={r.sweep} theory={r.theory} at={osr} hover={hoverOsr} onhover={(i) => (hoverOsr = i)} label="In-band SNDR against OSR, measured and predicted" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">What the band holds</span><span>ifilter to {freqText(FS / (2 * osr))}</span></span>
        <span>rms left outside <b>{nf(outside * 1e3, 2)} mV</b></span>
      </div>
      <BandChart data={r.data} inband={r.inband} count={COUNT} hover={hoverT} onhover={(i) => (hoverT = i)} label="The output and the part of it in the band" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 34px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; }
  .group .label { color: var(--ink-3); }
  .about { font-size: 12.5px; color: var(--ink-3); }
  .compare { --rows: repeat(2, minmax(0, 1fr)); }
</style>

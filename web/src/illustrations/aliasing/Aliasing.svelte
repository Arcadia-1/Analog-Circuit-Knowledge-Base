<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { freqText, nf } from '../../lib/format';
  import { residual } from '../../lib/frequency';
  import { clamp } from '../../lib/scale';
  import { N_FFT } from '../../lib/spectrum';
  import FoldChart from './FoldChart.svelte';
  import { F_MAX, FS, KEEP, N_BITS, read, twins, zoneOf } from './model';
  import SampleChart from './SampleChart.svelte';
  import ZoneRuler from './ZoneRuler.svelte';

  const COUNT = 32;

  // a tone in the third zone: it lands at 230 MHz, H2 lands where 2 × 230 does, H3 folds off the far end and back
  let target = $state(1.23e9);
  let keep = $state(1);
  let hd2 = $state(-70);
  let hd3 = $state(-60);
  let hoverF = $state<number | null>(null);
  let hoverK = $state<number | null>(null);
  let hoverBin = $state<number | null>(null);

  const r = $derived(read(target, keep, hd2, hd3));
  const tone = $derived(r.landings[0]);
  const zone = $derived(zoneOf(r.fin, r.fsOut));
  const mirrored = $derived(residual(r.fin, r.fsOut) < 0);
  const others = $derived(twins(r.fin, r.fsOut).filter((f) => Math.abs(f - r.fin) > 1));
  const marks = $derived(r.landings.slice(1).map((l) => ({ bin: Math.round((l.lands / r.fsOut) * N_FFT), text: `H${l.order}` })));
  const rate = (fs: number) => (fs >= 1e9 ? `${fs / 1e9} GS/s` : `${Math.round(fs / 1e5) / 10} MS/s`);
  const setTarget = (hz: number) => (target = clamp(hz, 1e6, F_MAX - 1e6));
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/">ADCToolbox</a>
    <h1>Aliasing and Nyquist zones</h1>
    <p class="sub">Whatever goes in comes out between 0 and half the sampling rate, and so do its harmonics.</p>
    <div class="pick">
      <span class="label">Keep</span>
      <Segmented size="sm" label="Keep every N-th sample" options={KEEP.map((k) => ({ value: k, label: k === 1 ? 'every sample' : `1 in ${k}` }))} bind:value={keep} />
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>fundamentals/</code>: <a href="/doc/api/fundamentals#adctoolbox.fold_frequency_to_nyquist"><code>fold_frequency_to_nyquist</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fold_bin_to_nyquist"><code>fold_bin_to_nyquist</code></a>, <a href="/doc/api/fundamentals#adctoolbox.find_coherent_frequency"><code>find_coherent_frequency</code></a>. <code>siggen/nonidealities.py</code>: <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_static_nonlinearity_hd"><code>apply_static_nonlinearity_hd</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_thermal_noise"><code>apply_thermal_noise</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_quantization_noise"><code>apply_quantization_noise</code></a>. <code>spectrum/</code>: <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a>. This page is the interactive companion to its examples <code>exp_c01</code> and <code>exp_d00</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_aliasing.py">python/adc_aliasing.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same samples and every number here matches it.</p>
      <p><b>The fold.</b> A sampler at <var>f</var><sub>s</sub> cannot tell <var>f</var> from <var>f</var> plus any multiple of <var>f</var><sub>s</sub>, nor a tone at −<var>f</var> from one at <var>f</var>, so every input lands at |<var>f</var> − <var>f</var><sub>s</sub>·round(<var>f</var> / <var>f</var><sub>s</sub>)|, somewhere from 0 to <var>f</var><sub>s</sub>/2. The Nyquist zones are the half-rate steps of the input. In the odd ones the landing follows the input up; in the shaded even ones it runs the other way, and a whole band sampled there arrives with its spectrum turned over.</p>
      <p><b>The samples cannot tell.</b> The dots are all the record holds, and the blue line is the one sine below <var>f</var><sub>s</sub>/2 that passes through every one of them; the grey input is only one of the tones that do. That is why a converter needs an anti-alias filter in front, and why a band in a higher zone can be sampled on purpose, as long as the filter passes that zone and no other.</p>
      <p><b>Harmonics fold too.</b> The converter's own distortion puts H2 and H3 at 2<var>f</var> and 3<var>f</var>, and they land where those land. The fold commutes with the multiplication, so the <var>h</var>-th harmonic lands where <var>h</var> times the tone's landing does: from the first zone alone you can say where every spur will be. The odd number of cycles, coprime with the record, that <code>find_coherent_frequency</code> picks keeps them off the tone and off each other.</p>
      <p><b>Keeping one sample in <var>N</var></b>, with no filter first, as a monitor or debug port does in <code>exp_d00</code>, is a second sampler at <var>f</var><sub>s</sub>/<var>N</var>: the zones are <var>N</var> times narrower and everything above <var>f</var><sub>s</sub>/2<var>N</var> folds again. The spurs move but keep their height in dBc, and the noise keeps its power, so ENOB stays where it was while the floor in each bin rises by 10·log<sub>10</sub> <var>N</var>.</p>
      <p><b>The record.</b> {N_FFT} kept samples, so {N_FFT} × <var>N</var> at the converter, a 12-bit quantiser on a 0 … 1 V range with 0.3 LSB of thermal noise ahead of it, as in <code>exp_d00</code>. The tone sits on the odd bin coprime with that length nearest the frequency you ask for, which is why the value snaps as you drag.</p>
    </Notes>
  </header>

  <section class="tuner" aria-label="Input frequency">
    <div class="tuner-left">
      <label class="label" for="fin">Input</label>
      <ValueField id="fin" value={r.fin / 1e6} digits={3} unit="MHz" step={1} onchange={(v) => setTarget(v * 1e6)} title="Type a frequency in MHz, or use ↑ ↓ to step 1 MHz (Shift: 10 MHz)" />
      <div class="legend">
        <span><span class="key k1"></span>lands at <b class="mono">{freqText(tone.lands)}</b>, from zone {zone} at {rate(r.fsOut)}{mirrored ? ', mirrored' : ''}</span>
        <span><span class="key k2"></span>H2 lands at <b class="mono">{freqText(r.landings[1].lands)}</b>, H3 at <b class="mono">{freqText(r.landings[2].lands)}</b></span>
      </div>
    </div>
    <ZoneRuler f={r.fin} fsOut={r.fsOut} onchange={setTarget} />
  </section>

  <section class="controls" aria-label="The converter">
    <div class="group accent2">
      <span class="label">Distortion</span>
      <Range id="hd2" min={-100} max={-40} step={1} output="{nf(hd2, 0)} dBc" bind:value={hd2}>HD2</Range>
      <Range id="hd3" min={-100} max={-40} step={1} output="{nf(hd3, 0)} dBc" bind:value={hd3}>HD3</Range>
    </div>
    <span class="about">{N_BITS}-bit converter at {rate(FS)} · −1 dBFS tone · 0.3 LSB noise · bin {r.bin} of {keep * N_FFT}</span>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap">
        <span class="left"><span class="label">Where it lands</span><span>every input from 0 to 3 GHz, sampled at {rate(r.fsOut)}</span></span>
        <span>{others.length} other inputs land on <b>{freqText(tone.lands)}</b></span>
      </div>
      <FoldChart fsOut={r.fsOut} landings={r.landings} twins={others} hover={hoverF} onhover={(f) => (hoverF = f)} label="Output frequency against input frequency" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">What the samples see</span><span>the first {COUNT} kept</span></span>
        <span>a <b>{freqText(tone.lands)}</b> sine{mirrored ? ', running backwards' : ''}</span>
      </div>
      <SampleChart fin={r.fin} fsOut={r.fsOut} {keep} samples={r.samples} count={COUNT} hover={hoverK} onhover={(k) => (hoverK = k)} label="Kept samples, the input and the slow sine through them" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Spectrum</span><span>of the kept samples</span></span>
        <span>SFDR <b>{nf(r.after.sfdr, 1)} dB</b> · ENOB <b>{nf(r.after.enob, 2)}</b>{keep > 1 ? ` · every sample: ${nf(r.before.sfdr, 1)} dB, ${nf(r.before.enob, 2)}` : ''}</span>
      </div>
      <SpectrumChart spectrum={r.after} n={N_BITS} series={1} fs={r.fsOut} {marks} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Spectrum of the kept samples" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .tuner { border-top: 1px solid var(--rule); padding-top: 8px; }
  .legend b { font-weight: 500; color: var(--ink); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 34px; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
  .group .label { color: var(--ink-3); }
  .about { font-size: 12.5px; color: var(--ink-3); }
  .compare { --rows: minmax(0, 0.9fr) minmax(0, 1fr); }
  .wide { grid-column: 1 / -1; }
  @media (max-width: 900px) {
    .wide { grid-column: auto; }
  }
</style>

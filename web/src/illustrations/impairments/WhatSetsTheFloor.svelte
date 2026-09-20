<script lang="ts">
  import { untrack } from 'svelte';
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, nf } from '../../lib/format';
  import PhaseChart from './PhaseChart.svelte';
  import SweepChart from './SweepChart.svelte';
  import { AM_BIN, BITS, FS, jitterFrom, N, read, strengthText, SWEEPS, sweep, TONE, type Kind, type Sweep } from './model';

  /** The six impairments, what their slider means, and the one line that says what to look for. */
  const KINDS: { value: Kind; label: string; slider: string; axis: string; sign: string }[] = [
    { value: 'thermal', label: 'Noise', slider: 'Noise', axis: 'noise rms', sign: 'The floor lifts, flat and everywhere at once. Nothing else moves, and SNDR follows the noise exactly.' },
    { value: 'quantiser', label: 'Resolution', slider: 'Bits', axis: 'bits', sign: 'Each bit buys 6.02 dB — until the converter is quieter than everything behind it, and the curve leaves the line.' },
    { value: 'jitter', label: 'Jitter', slider: 'Jitter', axis: 'clock jitter rms', sign: 'A floor again, but one that only exists where the signal moves: all of it is PM, and it grows with the input frequency.' },
    { value: 'settling', label: 'Settling', slider: 'Settling <var>k</var>', axis: 'settling k', sign: 'Lines, not a floor: SNDR falls while SNR stays put. The sampler is distorting, not adding noise.' },
    { value: 'memory', label: 'Memory', slider: 'Memory', axis: 'leak from the last sample', sign: 'The previous sample leaks into this one, so the error rides on the signal: harmonics, and an AM split.' },
    { value: 'interferer', label: 'Interferer', slider: 'Depth', axis: 'modulation depth', sign: 'One tone modulating another: two sidebands, SFDR and SNDR almost equal, and a pure AM signature.' },
  ];

  let kind = $state<Kind>('thermal');
  let index = $state(SWEEPS.thermal.strengths.indexOf(SWEEPS.thermal.start));
  let bin = $state(TONE.bin);
  let hoverBin = $state<number | null>(null);
  let hoverSweep = $state<number | null>(null);
  let hoverPhase = $state<number | null>(null);

  const meta = $derived(KINDS.find((k) => k.value === kind)!);
  const strengths = $derived(SWEEPS[kind].strengths);
  const strength = $derived(strengths[Math.min(index, strengths.length - 1)]);
  const fin = $derived((bin / N) * FS);
  const r = $derived(read(kind, strength, fin));
  const marks = $derived(
    kind === 'interferer' && strength > 0
      ? [{ bin: r.spectrum.signal - AM_BIN, text: '−fm' }, { bin: r.spectrum.signal + AM_BIN, text: '+fm' }]
      : [],
  );

  function pick(v: Kind) {
    kind = v;
    index = SWEEPS[v].strengths.indexOf(SWEEPS[v].start);
  }

  // one sweep is a dozen captures: run it once the controls rest, and show the last one faded meanwhile
  let swept = $state<{ of: Kind; sweep: Sweep } | null>(null);
  let sweptFor = $state('');
  const key = $derived(`${kind} ${bin}`);
  $effect(() => {
    const [k, hz, now] = [kind, fin, key];
    const id = setTimeout(() => {
      swept = { of: k, sweep: sweep(k, hz) };
      sweptFor = now;
    }, untrack(() => swept) ? 120 : 0);
    return () => clearTimeout(id);
  });
</script>

<main class="page">
  <header class="top">
    <div class="pick">
      <Range id="fin" min={51} max={2045} step={2} output={freqText(fin)} bind:value={bin}>Input</Range>
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>siggen/nonidealities.py</code>: <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_thermal_noise"><code>apply_thermal_noise</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_quantization_noise"><code>apply_quantization_noise</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_jitter"><code>apply_jitter</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_incomplete_sampling"><code>apply_incomplete_sampling</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_memory_effect"><code>apply_memory_effect</code></a>, <a href="/doc/api/siggen#adctoolbox.siggen.ADC_Signal_Generator.apply_am_tone"><code>apply_am_tone</code></a>; <code>fundamentals/</code>: <a href="/doc/api/fundamentals#adctoolbox.find_coherent_frequency"><code>find_coherent_frequency</code></a>, <a href="/doc/api/fundamentals#adctoolbox.amplitudes_to_snr"><code>amplitudes_to_snr</code></a>, <a href="/doc/api/fundamentals#adctoolbox.fundamentals.calculate_jitter_limit"><code>calculate_jitter_limit</code></a>, <a href="/doc/api/fundamentals#adctoolbox.snr_to_enob"><code>snr_to_enob</code></a>; <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a> and <a href="/doc/api/aout#adctoolbox.analyze_error_by_phase"><code>analyze_error_by_phase</code></a>. This page is the interactive companion to its examples <code>exp_g01</code>, <code>exp_g03</code>, <code>exp_g04</code>, <code>exp_g06</code>, <code>exp_g07</code> and <code>exp_a04</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_impairments.py">python/adc_impairments.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same samples and every number here matches it.</p>
      <p><b>The setup.</b> 4096 samples at 1 GS/s of a 0.45 V sine on a 0 … 1 V range, always on a coherent bin. Behind whichever impairment you pick sit 10 µV of thermal noise and a 14-bit converter, so the page never shows you a perfect part — it shows you what one flaw does to a good one. The spectrum is <code>analyze_spectrum</code> over the whole range, rectangular window, harmonics counted to the fifth.</p>
      <p><b>SNDR counts everything</b> that is not the tone; <b>SNR</b> leaves the harmonics out of it. When the two separate, the impairment is distorting rather than adding noise — that is the whole difference between the first three buttons and the last three.</p>
      <p><b>The dashed line</b> in the middle chart is the SNR that impairment alone would allow, and nothing else: <code>amplitudes_to_snr</code> for noise and for a quantiser's own <var>Δ</var>/√12, and <code>calculate_jitter_limit</code>, −20 log (2π <var>f</var><sub>in</sub> <var>τ</var>), for the clock. Measure the gap: where the curve sits below the line, something else is dominating. Settling, memory and an interferer distort instead, and have no such number.</p>
      <p><b>Against the phase</b> is the residual after the fitted sine is subtracted, binned by where in the cycle it happened, with ADCToolbox's split drawn over it. An error proportional to the signal has power ∝ cos²φ (AM); one proportional to its <em>slope</em> ∝ sin²φ (PM); noise has neither. Jitter is pure PM, which is why the clock's own rms can be read straight back out of it — <code>exp_a04</code> — and why moving the input frequency changes everything about it and nothing about the noise.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Impairment">
    <Segmented label="Impairment" options={KINDS.map((k) => ({ value: k.value, label: k.label }))} bind:value={() => kind, pick} />
    <Range id="strength" min={0} max={strengths.length - 1} step={1} output={strengthText(kind, strength)} bind:value={index}>
      {@html meta.slider}
    </Range>
    <p class="sign">{meta.sign}</p>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap">
        <span class="left"><span class="label">The spectrum</span><span>{strengthText(kind, strength)} at {freqText(fin)}</span></span>
        <span>SNDR <b>{nf(r.spectrum.sndr, 2)} dB</b> · SNR <b>{nf(r.snr, 2)} dB</b> · SFDR <b>{nf(r.spectrum.sfdr, 1)} dB</b> · ENOB <b>{nf(r.spectrum.enob, 2)}</b>{r.limit === null ? '' : ` · this alone would allow ${nf(r.limit, 2)} dB`}</span>
      </div>
      <SpectrumChart spectrum={r.spectrum} n={BITS} series={1} fs={FS} {marks} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Output spectrum" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">What it costs</span><span>against {meta.axis}</span></span>
        <span><span class="key k1"></span>SNDR · <span class="key k2"></span>SNR{swept?.sweep.limit.some((v) => v !== null) ? ' · dashed, allowed' : ''}</span>
      </div>
      {#if swept}
        <SweepChart sweep={swept.sweep} kind={swept.of} at={index} stale={sweptFor !== key} hover={hoverSweep} onhover={(i) => (hoverSweep = i)} label="SNDR and SNR against the strength of the impairment" />
      {/if}
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Against the phase</span><span>AM / PM split</span></span>
        <span>
          on the signal <b>{nf(r.split.am * 1e6, 1)}</b> · on its slope <b>{nf(r.split.pm * 1e6, 1)}</b> · neither <b>{nf(r.split.base * 1e6, 1)}</b> µV
          {#if kind === 'jitter'}· clock read back <b>{nf(jitterFrom(r.split, fin) * 1e15, 1)} fs</b>{/if}
        </span>
      </div>
      <PhaseChart split={r.split} hover={hoverPhase} onhover={(b) => (hoverPhase = b)} label="Residual against the phase of the input" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 28px; border-top: 1px solid var(--rule); padding-top: 12px; }
  .sign { margin: 0; color: var(--ink-2); font-size: 13.5px; flex: 1 1 320px; }
  .compare { --rows: minmax(0, 1fr) minmax(0, 1fr); }
  .wide { grid-column: 1 / -1; }
  @media (max-width: 900px) {
    .wide { grid-column: auto; }
    .sign { flex-basis: 100%; }
  }
</style>

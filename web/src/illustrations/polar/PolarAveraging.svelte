<script lang="ts">
  import { untrack } from 'svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, nf } from '../../lib/format';
  import AveragedChart from './AveragedChart.svelte';
  import { curve, FS, N, phaseDeg, read, RUNS, type Curve, type Setting, type Source } from './model';
  import PolarChart from './PolarChart.svelte';
  import RunsChart from './RunsChart.svelte';

  const SOURCES: { value: Source; label: string }[] = [
    { value: 'static', label: 'Static curve' },
    { value: 'memory', label: 'Memory effect' },
  ];
  const MODES = [
    { value: false, label: 'Power' },
    { value: true, label: 'Coherent' },
  ];
  const OFF = -120;

  // exp_s12's tone and distortion, ten runs
  let coherent = $state(true);
  let source = $state<Source>('static');
  let hd2 = $state(-80);
  let hd3 = $state(-73);
  let sign = $state<1 | -1>(1);
  let memory = $state(0.02);
  let target = $state(5e6);
  let noise = $state(100);
  let runs = $state(10);
  let hoverBin = $state<number | null>(null);
  let hoverPolar = $state<number | null>(null);
  let hoverRuns = $state<number | null>(null);

  const setting = $derived<Setting>({
    source,
    target,
    hd2: hd2 <= OFF ? null : hd2,
    hd3: hd3 <= OFF ? null : hd3,
    sign,
    memory,
    noise: noise * 1e-6,
  });
  const r = $derived(read(setting, runs));
  const shown = $derived(coherent ? r.coherent : r.power);
  const spoke = (h: number) => r.coherent.harmonicBins[h - 2];

  // the curve reruns every run count twice: do it once the controls rest, and show the last one faded meanwhile
  let lines = $state.raw<Curve | null>(null);
  let linesFor = $state.raw<Setting | null>(null);
  $effect(() => {
    const s = setting;
    const id = setTimeout(() => {
      lines = curve(s);
      linesFor = s;
    }, untrack(() => lines) ? 120 : 0);
    return () => clearTimeout(id);
  });

  const db = (v: number) => (v <= OFF ? 'off' : `${nf(v, 0)} dBc`);
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/">ADCToolbox</a>
    <h1>Averaging and the polar spectrum</h1>
    <p class="sub">Average a tone as powers or as aligned phasors, and read the phase of every harmonic.</p>
    <div class="pick">
      <span class="label">Averaging</span>
      <Segmented size="sm" label="Averaging" options={MODES} bind:value={coherent} />
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <code>spectrum/</code>: <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a> over several runs, which averages powers, and <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum_polar"><code>analyze_spectrum_polar</code></a>, which averages coherently, both through <code>compute_spectrum</code> with its phase alignment, harmonic bookkeeping and noise-floor estimate. <code>fundamentals/</code>: <a href="/doc/api/fundamentals#adctoolbox.find_coherent_frequency"><code>find_coherent_frequency</code></a>. This page is the interactive companion to its examples <code>exp_s07</code>, <code>exp_s10</code>, <code>exp_s11</code> and <code>exp_s12</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_polar_averaging.py">python/adc_polar_averaging.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same samples and every number here matches it.</p>
      <p><b>Averaging powers.</b> Each run's |<var>X</var>|² is averaged bin by bin. The noise floor becomes smoother, not lower: every bin still holds the same noise power on average, so SNR stays where one run put it.</p>
      <p><b>Averaging coherently.</b> Each run's spectrum is first turned so that its fundamental has phase 0, its <var>h</var>-th harmonic by <var>h</var> times that turn, and every other bin by its own fraction of it. Then the complex values are averaged. The tone and its harmonics add up in phase, and the noise, with a new phase every run, cancels: SNR gains 10 dB for every tenfold increase in runs. Distortion does not average away, so SNDR stops at the harmonics.</p>
      <p><b>The polar plot.</b> The coherently averaged spectrum, each bin at its phase, clockwise from the top, and at its level, outward from −120 dB. A static curve, <var>x</var> + <var>k</var><sub>2</sub><var>x</var>² + <var>k</var><sub>3</sub><var>x</var>³, puts HD2 and HD3 at 0°, and a negative <var>k</var><sub>3</sub> turns HD3 to 180°, wherever the tone is.</p>
      <p><b>A memory.</b> In <code>exp_s11</code>'s converter, part of each output comes from the previous sample's coarse 4-bit code. That part is distortion delayed by one sample, and a delay turns harmonic <var>h</var> by <var>h</var>·360°·<var>f</var><sub>in</sub>/<var>f</var><sub>s</sub>, so its spokes swing as the input moves. The magnitude spectrum of a memory looks like any other distortion; its phases do not.</p>
      <p><b>The record.</b> {N} samples at 100 MHz, a 0.499 V sine at a new random phase in each run (the same hundred phases every time), the rectangular window the polar plot uses, and harmonics 2 to 5. The memory converter works on the sine plus 0.5 V, as in <code>exp_s11</code>.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="The distortion">
    <div class="group">
      <span class="label">Source</span>
      <Segmented size="sm" label="Source of distortion" options={SOURCES} bind:value={source} />
      {#if source === 'static'}
        <Range id="hd2" min={OFF} max={-50} step={1} output={db(hd2)} bind:value={hd2}>HD2</Range>
        <Range id="hd3" min={OFF} max={-50} step={1} output={db(hd3)} bind:value={hd3}>HD3</Range>
        <Segmented size="sm" mono label="Sign of the cubic term" options={[{ value: 1, label: 'k3 > 0' }, { value: -1, label: 'k3 < 0' }]} bind:value={sign} />
      {:else}
        <Range id="memory" min={0} max={0.1} step={0.002} output={nf(memory, 3)} bind:value={memory}>Memory</Range>
      {/if}
    </div>
  </section>

  <section class="controls second" aria-label="The capture">
    <div class="group">
      <Range id="fin" min={1e6} max={49e6} step={0.25e6} output={freqText(r.fin)} bind:value={target}>Input</Range>
      <Range id="noise" min={10} max={1000} step={10} output="{noise} µV" bind:value={noise}>Noise</Range>
    </div>
    <div class="group">
      <span class="label">Runs</span>
      <Segmented size="sm" mono label="Number of runs" options={RUNS.map((v) => ({ value: v, label: String(v) }))} bind:value={runs} />
    </div>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap">
        <span class="left"><span class="label">Spectrum</span><span>{runs} run{runs > 1 ? 's' : ''}, {coherent ? 'averaged coherently' : 'averaged as powers'}</span></span>
        <span>SNR <b>{nf(shown.snr, 1)} dB</b> · SNDR <b>{nf(shown.sndr, 1)} dB</b> · HD3 <b>{nf(shown.harmonics[1], 1)} dBc</b></span>
      </div>
      <AveragedChart spectrum={shown} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Averaged spectrum" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Polar spectrum</span><span>coherent, phase against the tone</span></span>
        <span>HD2 <b>∠{nf(phaseDeg(r.coherent, spoke(2)), 0)}°</b> · HD3 <b>∠{nf(phaseDeg(r.coherent, spoke(3)), 0)}°</b></span>
      </div>
      <PolarChart spectrum={r.coherent} hover={hoverPolar} onhover={(b) => (hoverPolar = b)} label="Polar spectrum: phase and level of every bin" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">SNR against runs</span><span>solid SNR, dashed SNDR; <span class="s2">power</span>, <span class="s1">coherent</span></span></span>
        {#if lines}<span>100 runs: <b>{nf(lines.coherentSnr[lines.coherentSnr.length - 1] - lines.powerSnr[lines.powerSnr.length - 1], 1)} dB</b> more SNR coherently</span>{/if}
      </div>
      {#if lines}
        <RunsChart curve={lines} stale={linesFor !== setting} at={runs} {coherent} hover={hoverRuns} onhover={(i) => (hoverRuns = i)} label="SNR and SNDR against the number of runs, both ways of averaging" />
      {:else}
        <div class="wait">averaging 1 to 100 runs…</div>
      {/if}
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 30px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .controls.second { border-top: 0; padding-top: 0; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 18px; }
  .group .label { color: var(--ink-3); }
  .controls :global(.range) { --range-width: 120px; }
  .s1 { color: var(--s1); }
  .s2 { color: var(--s2); }
  .wait { flex: 1 1 auto; display: grid; place-items: center; color: var(--ink-3); font-size: 13px; }
  .compare { --rows: minmax(0, 0.85fr) minmax(0, 1.15fr); }
  .wide { grid-column: 1 / -1; }
  @media (max-width: 900px) {
    .wide { grid-column: auto; }
  }
</style>

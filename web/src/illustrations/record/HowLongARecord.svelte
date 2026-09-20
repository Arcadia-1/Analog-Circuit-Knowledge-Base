<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import { freqText, nf } from '../../lib/format';
  import LengthChart from './LengthChart.svelte';
  import CaptureChart from './CaptureChart.svelte';
  import { BITS, FS, HD3_DBC, LENGTHS, noiseFor, read, RUNS, sweepStream, TARGET_ENOB, type LengthRow } from './model';
  import StabilityChart from './StabilityChart.svelte';

  let index = $state(LENGTHS.indexOf(4096));
  let hd3 = $state(HD3_DBC);
  let enob = $state(TARGET_ENOB);
  let hoverSweep = $state<number | null>(null);
  let hoverCapture = $state<number | null>(null);
  let hoverStability = $state<number | null>(null);
  let hoverBin = $state<number | null>(null);

  const n = $derived(LENGTHS[index]);
  const noise = $derived(noiseFor(enob));
  const r = $derived(read(n, 0, noise, hd3));
  const h3Bin = $derived(r.spectrum.harmonics[1]);
  const h3Visible = $derived(r.spectrum.spur === h3Bin);
  const binGain = $derived(10 * Math.log10(n / LENGTHS[0]));

  const timeText = (seconds: number) => {
    if (seconds >= 1e-3) return `${nf(seconds * 1e3, 2)} ms`;
    if (seconds >= 1e-6) return `${nf(seconds * 1e6, 2)} µs`;
    return `${nf(seconds * 1e9, 1)} ns`;
  };

  // the sweep is a couple of hundred captures: run it a few milliseconds at a time so the page stays under the hand
  let rows = $state<LengthRow[]>([]);
  let running = $state(true);
  const selected = $derived(rows.find((row) => row.n === n) ?? null);
  $effect(() => {
    const steps = sweepStream(noise, hd3, BITS);
    const found: LengthRow[] = [];
    let id: ReturnType<typeof setTimeout> | undefined;
    rows = [];
    running = true;
    const step = () => {
      const until = performance.now() + 10;
      while (performance.now() < until) {
        const next = steps.next();
        if (next.done) {
          rows = found;
          running = false;
          return;
        }
        if (next.value) {
          found.push(next.value);
          rows = [...found];
        }
      }
      id = setTimeout(step, 0);
    };
    step();
    return () => clearTimeout(id);
  });
</script>

<main class="page">
  <header class="top">
    <div class="pick">
      <Range id="n" min={0} max={LENGTHS.length - 1} step={1} output="{n} points" bind:value={index}>Record</Range>
    </div>
    <Notes>
      <p><b>The rule to remember.</b> With <var>N</var> samples at <var>f</var><sub>s</sub>, the bin spacing is Δ<var>f</var> = <var>f</var><sub>s</sub>/<var>N</var>. Doubling <var>N</var> halves that spacing and spreads the same broadband-noise power over twice as many bins, so the average noise power in each bin falls by 3.01 dB. The total noise power is unchanged.</p>
      <p><b>That separates SNDR from SFDR.</b> SNDR adds every non-signal bin, so a longer record should converge to the same SNDR and ENOB; it only makes the estimate steadier. SFDR looks at the single tallest non-signal line. It rises while that line is a random noise bin, then stops when a real harmonic becomes tallest. Record length improves visibility, not converter linearity.</p>
      <p><b>How to choose <var>N</var>.</b> Start with the bin spacing you need: <var>N</var> ≥ <var>f</var><sub>s</sub>/Δ<var>f</var><sub>required</sub>. The window still decides how many adjacent bins one tone occupies. Then make the record long enough that repeated captures meet your allowed SNDR spread and the spur you care about stands above the tallest noise bin. Report <var>N</var>, <var>f</var><sub>s</sub> and the window with any SFDR number; without them, the number is incomplete.</p>
      <p><b>The experiment.</b> A {BITS}-bit converter runs at {FS / 1e6} MS/s with a coherent tone, a third harmonic at the level you set, and enough white noise to reach the ENOB you set. Each length gets {RUNS} fresh-noise captures. The shaded bands are their full range; the repeatability plot uses their standard deviation.</p>
      <p><b>Checked against ADCToolbox 0.9.1.</b> <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a> uses its default Hann window and automatic signal side bins. <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_record_length.py">python/adc_record_length.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same deterministic captures; the TypeScript model is pinned to those results in the test suite.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="The converter">
    <Range id="hd3" min={-100} max={-50} step={1} output="{nf(hd3, 0)} dBc" bind:value={hd3}>Third harmonic</Range>
    <Range id="enob" min={5} max={11} step={0.5} output="{nf(enob, 1)} bits" bind:value={enob}>Noise, as ENOB</Range>
    <span class="unit">{nf(noise * 1e6, 1)} µV rms</span>
  </section>

  <section class="facts" aria-label="What this record length buys">
    <div><span class="label">Captured time</span><b>{timeText(n / FS)}</b><small><var>N</var>/<var>f</var><sub>s</sub></small></div>
    <div><span class="label">Bin spacing</span><b>{freqText(FS / n)}</b><small>Δ<var>f</var> = <var>f</var><sub>s</sub>/<var>N</var></small></div>
    <div><span class="label">Noise per bin</span><b>{binGain ? `−${nf(binGain, 1)} dB` : 'reference'}</b><small>versus {LENGTHS[0]} points</small></div>
    <div><span class="label">SNDR repeatability</span><b>{selected ? `±${nf(selected.sndr.sigma, 2)} dB` : 'measuring…'}</b><small>{RUNS} fresh-noise captures</small></div>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Across record lengths</span><span>SFDR rises until the real spur appears; SNDR converges</span></span>
        <span>
          <span class="key k1"></span>SFDR · <span class="key k2"></span>SNDR
          {#if selected}· at {n} points, SNDR spread <b>±{nf(selected.sndr.sigma, 2)} dB</b>{/if}
          {#if running}· still measuring{/if}
        </span>
      </div>
      <LengthChart {rows} at={n} {hd3} hover={hoverSweep} onhover={(i) => (hoverSweep = i)} label="SFDR and SNDR against record length, with the range the captures covered" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Selected capture</span><span>samples ordered by input phase</span></span>
        <span>{n} points · sample error below</span>
      </div>
      <CaptureChart data={r.data} bin={r.bin} hd3={r.hd3} bits={BITS} hover={hoverCapture} onhover={(i) => (hoverCapture = i)} label="Selected record plotted against input phase with the error of each sample" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">One spectrum</span><span>{n} points · Δf {freqText(FS / n)}</span></span>
        <span>{h3Visible ? 'H3 is now the tallest spur' : 'a noise bin is still taller than H3'} · SNDR <b>{nf(r.spectrum.sndr, 1)}</b> · SFDR <b>{nf(r.spectrum.sfdr, 1)} dB</b></span>
      </div>
      <SpectrumChart spectrum={r.spectrum} n={BITS} series={1} fs={FS} marks={[{ bin: h3Bin, text: 'H3' }]} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="The spectrum of one capture at the chosen record length" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Repeatability</span><span>the spread of one SNDR reading</span></span>
        <span>{selected ? `at ${n} points, ±${nf(selected.sndr.sigma, 2)} dB` : 'measuring the selected length…'}</span>
      </div>
      <StabilityChart {rows} at={n} hover={hoverStability} onhover={(i) => (hoverStability = i)} label="Standard deviation of SNDR across repeated captures against record length" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 28px; border-top: 1px solid var(--rule); padding-top: 12px; }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--rule); }
  .facts > div { min-width: 0; padding: 8px 16px 9px; display: grid; grid-template-columns: max-content 1fr; align-items: baseline; gap: 1px 12px; }
  .facts > div + div { border-left: 1px solid var(--rule); }
  .facts b { justify-self: end; font: 500 17px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .facts small { grid-column: 1 / -1; color: var(--ink-3); font-size: 11.5px; white-space: nowrap; }
  .compare { --rows: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 900px) {
    .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .facts > div:nth-child(3) { border-left: 0; border-top: 1px solid var(--rule); }
    .facts > div:nth-child(4) { border-top: 1px solid var(--rule); }
  }
  @media (max-width: 520px) {
    .facts { grid-template-columns: minmax(0, 1fr); }
    .facts > div:nth-child(n) { border-left: 0; }
    .facts > div:nth-child(n + 2) { border-top: 1px solid var(--rule); }
  }
</style>

<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { freqText, nf } from '../../lib/format';
  import LengthChart from './LengthChart.svelte';
  import { BITS, FS, HD3_DBC, LENGTHS, nearNyquist, noiseFor, read, RUNS, SAR_BITS, sweepStream, TARGET_ENOB, type LengthRow } from './model';
  import ShortChart from './ShortChart.svelte';

  let index = $state(LENGTHS.indexOf(4096));
  let hd3 = $state(HD3_DBC);
  let enob = $state(TARGET_ENOB);
  let sarBits = $state(SAR_BITS);
  let hoverSweep = $state<number | null>(null);
  let hoverShort = $state<number | null>(null);
  let hoverBin = $state<number | null>(null);

  const n = $derived(LENGTHS[index]);
  const noise = $derived(noiseFor(enob));
  const r = $derived(read(n, 0, noise, hd3));
  const short = $derived(nearNyquist(sarBits));

  // the sweep is a couple of hundred captures: run it a few milliseconds at a time so the page stays under the hand
  let rows = $state<LengthRow[]>([]);
  let running = $state(true);
  $effect(() => {
    const steps = sweepStream(noise, hd3, BITS);
    const found: LengthRow[] = [];
    let id: ReturnType<typeof setTimeout> | undefined;
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
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>How long a record</h1>
    <p class="sub">How many samples a number needs before it stops being an accident of which noise you caught.</p>
    <div class="pick">
      <Range id="n" min={0} max={LENGTHS.length - 1} step={1} output="{n} points" bind:value={index}>Record</Range>
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a> at its defaults — the Hann window, and the side bins it detects from the waveform itself; <code>models/sar.py</code>: <a href="/doc/api/models#adctoolbox.sar_convert"><code>sar_convert</code></a>, <a href="/doc/api/models#adctoolbox.sar_reconstruct"><code>sar_reconstruct</code></a> and <code>sar_ideal_weights</code>, which together come to a plain floor quantiser; <code>fundamentals/</code>: <a href="/doc/api/fundamentals#adctoolbox.snr_to_enob"><code>snr_to_enob</code></a> and <a href="/doc/api/fundamentals#adctoolbox.enob_to_snr"><code>enob_to_snr</code></a>, to set the noise that hits a target ENOB. This page is the interactive companion to its examples <code>exp_s13</code>, <code>exp_s09</code> and the single captures of <code>exp_s01</code>–<code>exp_s05</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_record_length.py">python/adc_record_length.py</a> runs <a href="https://github.com/Arcadia-1/ADCToolbox">ADCToolbox</a> on the same samples and every number here matches it.</p>
      <p><b>The setup</b> is <code>exp_s13</code>'s: a {BITS}-bit converter at {FS / 1e6} MS/s with a tone at 0.123 of <var>f</var><sub>s</sub>, a third harmonic at a level you set, and enough thermal noise to bring it to the effective bits you ask for. Every record length gets {RUNS} captures with fresh noise, and the band is the range those captures covered.</p>
      <p><b>SNDR does not improve with length.</b> It is a ratio of powers, and both sides grow with the record; only the <em>spread</em> narrows, from ±2.8 dB at sixteen points to ±0.07 dB at sixteen thousand. That is the answer to how long a record has to be: long enough that the number you quote is the converter's and not the noise's.</p>
      <p><b>SFDR does improve with length</b> — until it doesn't. While the tallest thing besides the signal is a noise bin, doubling the record buries that bin 3 dB deeper, because the same noise power is spread over twice as many bins. The moment the real harmonic outgrows the noise bins, the curve flattens against it, and the dashed line shows where. Reading an SFDR without its record length is meaningless, which is why datasheets quote one.</p>
      <p><b>Short records near Nyquist</b> are the other failure, and <code>exp_s09</code>'s: a small converter with the tone as close to Nyquist as the record allows. With so few bins the quantisation error is not remotely white — it folds onto a handful of them — and whether the length is even or odd moves SFDR by ten decibels at a time. The SNDR sits near its ideal {nf(6.02 * SAR_BITS + 1.76, 1)} dB for {SAR_BITS} bits from the start, since that is a total and does not care where the power landed.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="The converter">
    <Range id="hd3" min={-100} max={-50} step={1} output="{nf(hd3, 0)} dBc" bind:value={hd3}>Third harmonic</Range>
    <Range id="enob" min={5} max={11} step={0.5} output="{nf(enob, 1)} bits" bind:value={enob}>Noise, as ENOB</Range>
    <span class="unit">{nf(noise * 1e6, 1)} µV rms</span>
    <div class="group">
      <span class="label">Near Nyquist</span>
      <Segmented size="sm" mono label="Resolution of the small converter" options={[4, 6, 8].map((b) => ({ value: b, label: String(b) }))} bind:value={sarBits} />
      <span class="unit">bits</span>
    </div>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap">
        <span class="left"><span class="label">What length buys</span><span>{RUNS} captures at each, mean and range</span></span>
        <span>
          <span class="key k1"></span>SFDR · <span class="key k2"></span>SNDR
          {#if rows.length}· at {n} points, SNDR spread <b>±{nf(rows[Math.min(index, rows.length - 1)].sndr.sigma, 2)} dB</b>{/if}
          {#if running}· still measuring{/if}
        </span>
      </div>
      <LengthChart {rows} at={n} {hd3} hover={hoverSweep} onhover={(i) => (hoverSweep = i)} label="SFDR and SNDR against record length, with the range the captures covered" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">One capture</span><span>{n} points, tone on bin {r.bin}</span></span>
        <span>SNDR <b>{nf(r.spectrum.sndr, 1)}</b> · SFDR <b>{nf(r.spectrum.sfdr, 1)} dB</b> · ENOB <b>{nf(r.spectrum.enob, 2)}</b></span>
      </div>
      <SpectrumChart spectrum={r.spectrum} n={BITS} series={1} fs={FS} marks={[{ bin: r.spectrum.harmonics[1], text: 'H3' }]} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="The spectrum of one capture at the chosen record length" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Too short, near Nyquist</span><span>even records solid, odd dashed</span></span>
        <span>{freqText((FS * short[short.length - 1].bin) / short[short.length - 1].n)} in, a {sarBits}-bit converter</span>
      </div>
      <ShortChart rows={short} bits={sarBits} hover={hoverShort} onhover={(i) => (hoverShort = i)} label="SFDR and SNDR of a small converter at short record lengths, the tone just below Nyquist" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 28px; border-top: 1px solid var(--rule); padding-top: 12px; }
  .group { display: flex; align-items: center; gap: 8px; }
  .group .label { color: var(--ink-3); }
  .compare { --rows: minmax(0, 0.95fr) minmax(0, 1fr); }
  .wide { grid-column: 1 / -1; }
  @media (max-width: 900px) {
    .wide { grid-column: auto; }
  }
</style>

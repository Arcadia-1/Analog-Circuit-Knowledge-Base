<script lang="ts">
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { nf } from '../../lib/format';
  import { SIDE_BINS, type Window } from '../../lib/spectrum';
  import { baseCycles, capture, idealCode, LENGTHS, read, sweep } from './model';
  import OffsetChart from './OffsetChart.svelte';
  import SeamChart from './SeamChart.svelte';
  import ZoomChart from './ZoomChart.svelte';

  const WINDOWS: { value: Window; label: string }[] = [
    { value: 'rectangular', label: 'None' },
    { value: 'hann', label: 'Hann' },
    { value: 'blackmanharris', label: 'Blackman–Harris' },
    { value: 'flattop', label: 'Flat top' },
  ];

  // a tenth of a bin off, with no window: the number the page exists for
  let n = $state(12);
  let len = $state(4096);
  let offset = $state(0.1);
  let kind = $state<Window>('rectangular');
  let sideBin = $state(0);
  let noise = $state(0);
  let hoverBin = $state<number | null>(null);
  let hoverZoom = $state<number | null>(null);
  let hoverSweep = $state<number | null>(null);
  let hoverSeam = $state<number | null>(null);

  const base = $derived(baseCycles(len));
  const cycles = $derived(base + offset);
  const { spectrum, bin } = $derived(read(n, len, cycles, kind, sideBin, noise, 3));
  const coherent = $derived(read(n, len, base, kind, sideBin, noise, 3).spectrum);
  const curve = $derived(sweep(n, len, kind, sideBin, noise, 3, 41));
  const reference = $derived(sweep(n, len, 'rectangular', 0, noise, 3, 41));
  const lost = $derived(coherent.enob - spectrum.enob);
  const samples = $derived(capture(n, len, cycles, noise, 3));
  const seam = $derived(Math.abs(samples[0] - idealCode(n, len, cycles, len)));

  function pick(k: Window) {
    kind = k;
    sideBin = SIDE_BINS[k];
  }
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Coherent sampling</h1>
    <p class="sub">A perfect converter, measured badly. The tone is a fraction of a bin off, and that is all it takes.</p>
    <div class="pick">
      <span class="label">Resolution</span>
      <Segmented size="sm" mono label="Resolution in bits" options={[10, 12, 14].map((b) => ({ value: b, label: String(b) }))} bind:value={n} />
      <span class="unit">bits</span>
    </div>
    <Notes>
      <p><b>Ported from ADCToolbox 0.9.1.</b> <a href="/doc/api/spectrum#adctoolbox.analyze_spectrum"><code>analyze_spectrum</code></a> with the window, its power correction of 4 / mean(<var>w</var>²) and the side bins that count as signal, all from <code>spectrum/compute_spectrum</code> and <code>spectrum/_window</code>. This page is the interactive companion to its examples <code>exp_b02</code>, <code>exp_s06</code>, <code>exp_s08</code> and <code>exp_s09</code>; <a href="https://github.com/Arcadia-1/Analog-Circuit-Knowledge-Base/blob/main/web/python/adc_coherent_sampling.py">python/adc_coherent_sampling.py</a> runs <a href="/doc/">the library</a> on the same samples and every number here matches it.</p>
      <p><b>The converter is perfect.</b> Nothing here is an ADC defect: an ideal quantiser, an exact sine, no noise unless you add some. Everything you see the measurement do to it, the measurement did on its own.</p>
      <p><b>Coherent</b> means the record holds a whole number of cycles, so it joins onto itself and the tone lands in exactly one bin. Leave a fraction of a cycle over and the record has a step at the seam; the FFT has no way to tell that step from signal, so it spreads the tone across every bin. A tenth of a bin is enough to read <b>2.2 ENOB</b> off a perfect 12-bit converter.</p>
      <p><b>A window</b> tapers the record to zero at both ends so there is no step to spread. It costs main-lobe width — the tone now occupies several bins — which is why each window comes with the number of side bins that must be counted as signal. ADCToolbox's defaults: none 0, Hann 1, Blackman–Harris 3, flat top 4. Count too few and you throw away signal; too many and you hide a close-in spur.</p>
      <p><b>Choosing.</b> If you control the frequency, make it coherent and use no window: nothing beats an unwindowed coherent capture, and the odd number of cycles keeps every harmonic off the fundamental. If you do not — a free-running source, a recorded file — a window is not a nicety. Blackman–Harris loses nothing at a tenth of a bin, where an unwindowed capture has already lost ten.</p>
      <p><b>Record length</b> buys resolution, not signal-to-noise. The same total quantisation noise spread over twice as many bins sits 3 dB lower in each of them, so the floor drops and close spurs separate, while ENOB stays where it was. Watch SFDR climb and ENOB hold as you lengthen the record.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Capture and analysis">
    <div class="group">
      <span class="label">Capture</span>
      <Range id="offset" min={-0.5} max={0.5} step={0.01} output="{nf(offset, 2)} bin" bind:value={offset}>Off a bin by</Range>
      <span class="cycles mono">{nf(cycles, 2)} cycles in {len}</span>
      <Range id="noise" min={0} max={2} step={0.1} output="{nf(noise, 1)} LSB" bind:value={noise}>Noise</Range>
    </div>
    <div class="group accent2">
      <span class="label">Analysis</span>
      <Segmented size="sm" label="Window" options={WINDOWS} bind:value={() => kind, pick} />
      <Range id="side" min={0} max={8} step={1} output="{sideBin} bins" bind:value={sideBin}>Counted as signal</Range>
      <Segmented size="sm" mono label="Record length" options={LENGTHS.map((v) => ({ value: v, label: String(v) }))} bind:value={len} />
    </div>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Spectrum</span><span>of a perfect {n}-bit converter</span></span>
        <span>ENOB <b>{nf(spectrum.enob, 2)}</b> · SFDR <b>{nf(spectrum.sfdr, 1)} dB</b>{lost > 0.05 ? ` · ${nf(lost, 2)} bits lost to the measurement` : ' · nothing lost'}</span>
      </div>
      <SpectrumChart spectrum={spectrum} {n} series={1} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="Output spectrum" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Where leakage begins</span><span>the FFT repeats this record forever</span></span>
        <span>boundary step <b>{nf(seam, 0)} codes</b></span>
      </div>
      <SeamChart data={samples} {n} {cycles} hover={hoverSeam} onhover={(i) => (hoverSeam = i)} label="End and beginning of the record compared with the continuous input sine" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">Around the tone</span><span>±24 bins</span></span>
        <span>{sideBin === 0 ? 'one bin' : `${2 * sideBin + 1} bins`} counted as signal</span>
      </div>
      <ZoomChart {spectrum} {bin} {sideBin} span={24} hover={hoverZoom} onhover={(b) => (hoverZoom = b)} label="Bins around the tone" />
    </div>

    <div class="chart">
      <div class="cap">
        <span class="left"><span class="label">The cost of being off</span><span>this window, against none</span></span>
        <span class="coherent-readout">coherent <b>{nf(coherent.enob, 2)}</b> ENOB</span>
      </div>
      <OffsetChart {curve} {reference} at={offset} ideal={coherent.enob} hover={hoverSweep} onhover={(i) => (hoverSweep = i)} label="ENOB against offset from a bin" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 34px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 20px; }
  .group .label { color: var(--ink-3); }
  .cycles { font-size: 12.5px; color: var(--ink-3); }
  .coherent-readout { flex: 0 0 140px; white-space: nowrap; }
  .compare { --rows: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 900px) { .group { width: 100%; min-width: 0; } }
</style>

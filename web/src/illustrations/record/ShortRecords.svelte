<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import SpectrumChart from '../../components/chart/SpectrumChart.svelte';
  import { nf } from '../../lib/format';
  import { nearNyquist, SAR_BITS, SHORT, shortCapture } from './model';
  import CodeCoverageChart from './CodeCoverageChart.svelte';
  import PhaseCoverageChart from './PhaseCoverageChart.svelte';
  import ShortChart from './ShortChart.svelte';

  let bits = $state(SAR_BITS);
  let index = $state(SHORT.indexOf(16));
  let hover = $state<number | null>(null), hoverPhase = $state<number | null>(null);
  let hoverCode = $state<number | null>(null), hoverSpectrum = $state<number | null>(null);
  const rows = $derived(nearNyquist(bits));
  const n = $derived(SHORT[index]);
  const selected = $derived(rows[index]);
  const capture = $derived(shortCapture(n, bits));
  const visited = $derived(Array.from(capture.counts).filter((count) => count > 0).length);
  const peakToPeak = $derived(Math.max(...rows.map((row) => row.enob)) - Math.min(...rows.map((row) => row.enob)));
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Short records near Nyquist</h1>
    <p class="sub">A tiny record can sample only a few phases of the waveform and return a convincing wrong answer.</p>
    <div class="pick">
      <Range id="short-n" min={0} max={SHORT.length - 1} step={1} output="{n} points" bind:value={index}>Record</Range>
    </div>
    <Notes>
      <p><b>The setup is deliberately hostile.</b> For each record length, the coherent input tone occupies the last FFT bin below Nyquist. The input therefore changes with <var>N</var>, and a short record sees only a small set of converter codes and sine-wave phases.</p>
      <p><b>Even and odd lengths are different experiments.</b> Their last bins correspond to different phase sequences. At very small <var>N</var>, adding one sample can change the reported SNDR or SFDR more than doubling converter resolution would.</p>
      <p><b>The lesson is a guardrail.</b> Coherence prevents leakage, but it does not guarantee a representative capture. Use enough cycles and enough code coverage before treating a dynamic metric as a property of the ADC.</p>
    </Notes>
  </header>

  <section class="controls" aria-label="Ideal converter">
    <Range id="short-bits" min={2} max={8} step={1} output="{bits} bits" bind:value={bits}>Resolution</Range>
    <span class="unit">tone at bin {capture.bin} of {n} · {n % 2 ? 'odd' : 'even'} record</span>
  </section>

  <section class="facts" aria-label="Short-record result">
    <div><span class="label">Ideal resolution</span><b>{bits} bits</b><small>no added noise or mismatch</small></div>
    <div><span class="label">Codes actually visited</span><b>{visited} / {2 ** bits}</b><small>in the selected capture</small></div>
    <div><span class="label">Reported ENOB</span><b>{nf(selected.enob, 2)} bits</b><small>from only {n} samples</small></div>
    <div><span class="label">Across the sweep</span><b>{nf(peakToPeak, 2)} bits</b><small>ENOB swing from record choice alone</small></div>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap"><span class="left"><span class="label">The same ideal quantiser</span><span>tone always placed in the last bin below Nyquist</span></span><span><span class="key k1"></span>SFDR · <span class="key k2"></span>SNDR</span></div>
      <ShortChart {rows} {bits} at={n} {hover} onhover={(i) => (hover = i)} label="SNDR and SFDR from short even and odd records near Nyquist" />
    </div>

    <div class="chart">
      <div class="cap"><span class="left"><span class="label">Phases the record actually saw</span><span>the selected samples, reordered around one input cycle</span></span><span>{n} phase points</span></div>
      <PhaseCoverageChart phases={capture.phases} values={capture.data} hover={hoverPhase} onhover={(i) => (hoverPhase = i)} label="Input phases and quantized values visited by the selected short record" />
    </div>

    <div class="chart">
      <div class="cap"><span class="left"><span class="label">Code coverage</span><span>unvisited codes cannot contribute quantisation error</span></span><span>{visited} of {2 ** bits} codes</span></div>
      <CodeCoverageChart counts={capture.counts} hover={hoverCode} onhover={(i) => (hoverCode = i)} label="Histogram of ADC codes visited by the selected short record" />
    </div>

    <div class="chart">
      <div class="cap"><span class="left"><span class="label">The convincing spectrum</span><span>coherent and clean, but based on too little evidence</span></span><span>SNDR <b>{nf(selected.sndr, 1)}</b> · SFDR <b>{nf(selected.sfdr, 1)} dB</b></span></div>
      <SpectrumChart spectrum={capture.spectrum} n={bits} series={1} hover={hoverSpectrum} onhover={(i) => (hoverSpectrum = i)} label="Spectrum calculated from the selected short record" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto auto minmax(0, 1fr); }
  .controls { display: flex; align-items: center; gap: 12px 28px; border-top: 1px solid var(--rule); padding-top: 10px; }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--rule); }
  .facts > div { min-width: 0; padding: 9px 16px 10px; display: grid; grid-template-columns: max-content 1fr; align-items: baseline; gap: 1px 12px; }
  .facts > div + div { border-left: 1px solid var(--rule); }
  .facts b { justify-self: end; font: 500 17px var(--mono); white-space: nowrap; }
  .facts small { grid-column: 1 / -1; color: var(--ink-3); font-size: 11.5px; }
  .compare { --rows: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 900px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .facts > div:nth-child(3) { border-left: 0; border-top: 1px solid var(--rule); } .facts > div:nth-child(4) { border-top: 1px solid var(--rule); } }
  @media (max-width: 700px) { .facts { grid-template-columns: 1fr; } .facts > div:nth-child(n) { border-left: 0; } .facts > div:nth-child(n + 2) { border-top: 1px solid var(--rule); } }
</style>

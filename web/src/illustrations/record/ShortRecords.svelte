<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import { nf } from '../../lib/format';
  import { nearNyquist, SAR_BITS } from './model';
  import ShortChart from './ShortChart.svelte';

  let bits = $state(SAR_BITS);
  let hover = $state<number | null>(null);
  const rows = $derived(nearNyquist(bits));
  const tail = $derived(rows.slice(-4));
  const settled = $derived(tail.reduce((sum, row) => sum + row.enob, 0) / tail.length);
  const peakToPeak = $derived(Math.max(...rows.map((row) => row.enob)) - Math.min(...rows.map((row) => row.enob)));
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Short records near Nyquist</h1>
    <p class="sub">A tiny record can sample only a few phases of the waveform and return a convincing wrong answer.</p>
    <div class="pick">
      <Range id="short-bits" min={2} max={8} step={1} output="{bits} bits" bind:value={bits}>Ideal SAR</Range>
    </div>
    <Notes>
      <p><b>The setup is deliberately hostile.</b> For each record length, the coherent input tone occupies the last FFT bin below Nyquist. The input therefore changes with <var>N</var>, and a short record sees only a small set of converter codes and sine-wave phases.</p>
      <p><b>Even and odd lengths are different experiments.</b> Their last bins correspond to different phase sequences. At very small <var>N</var>, adding one sample can change the reported SNDR or SFDR more than doubling converter resolution would.</p>
      <p><b>The lesson is a guardrail.</b> Coherence prevents leakage, but it does not guarantee a representative capture. Use enough cycles and enough code coverage before treating a dynamic metric as a property of the ADC.</p>
    </Notes>
  </header>

  <section class="facts" aria-label="Short-record result">
    <div><span class="label">Ideal resolution</span><b>{bits} bits</b><small>no added noise or mismatch</small></div>
    <div><span class="label">Early ENOB swing</span><b>{nf(peakToPeak, 2)} bits</b><small>caused only by record choice</small></div>
    <div><span class="label">Longer-record ENOB</span><b>{nf(settled, 2)} bits</b><small>mean of the last four points</small></div>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap"><span class="left"><span class="label">The same ideal quantiser</span><span>tone always placed in the last bin below Nyquist</span></span><span><span class="key k1"></span>SFDR · <span class="key k2"></span>SNDR</span></div>
      <ShortChart {rows} {bits} {hover} onhover={(i) => (hover = i)} label="SNDR and SFDR from short even and odd records near Nyquist" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-block: 1px solid var(--rule); }
  .facts > div { min-width: 0; padding: 9px 16px 10px; display: grid; grid-template-columns: max-content 1fr; align-items: baseline; gap: 1px 12px; }
  .facts > div + div { border-left: 1px solid var(--rule); }
  .facts b { justify-self: end; font: 500 17px var(--mono); white-space: nowrap; }
  .facts small { grid-column: 1 / -1; color: var(--ink-3); font-size: 11.5px; }
  .compare { --rows: minmax(0, 1fr); }
  .wide { grid-column: 1 / -1; }
  @media (max-width: 700px) { .facts { grid-template-columns: 1fr; } .facts > div:nth-child(n) { border-left: 0; } .facts > div:nth-child(n + 2) { border-top: 1px solid var(--rule); } .wide { grid-column: auto; } }
</style>

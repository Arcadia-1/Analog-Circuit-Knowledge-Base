<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import { nf } from '../../lib/format';
  import DividerErrorChart from './DividerErrorChart.svelte';
  import DividerWordChart from './DividerWordChart.svelte';
  import { dividerSequence } from './model';

  let alpha = $state(0.125);
  let hover = $state<number | null>(null);
  const acc = $derived(dividerSequence(alpha, 'acc'));
  const mash = $derived(dividerSequence(alpha, 'sd'));
  const average = (a: Int8Array) => a.reduce((sum, v) => sum + v, 0) / a.length;
  const accMean = $derived(average(acc.y));
  const mashMean = $derived(average(mash.y));
  const mashMin = $derived(Math.min(...mash.y));
  const mashMax = $derived(Math.max(...mash.y));
</script>

<main class="page">
  <header class="top">
    <a class="crumb" href="/#lessons">← Interactive lessons</a>
    <h1>Inside a fractional divider</h1>
    <p class="sub">An accumulator is the first-order case; MASH 1-1-1 shapes the same error to third order.</p>
    <div class="pick accent2">
      <Range id="alpha" min={0.005} max={0.495} step={0.005} output={alpha.toFixed(3)} bind:value={alpha}><var>α</var></Range>
    </div>
    <Notes>
      <p><b>They are two orders of the same idea.</b> Both generate integer divider corrections <var>y</var>[<var>k</var>] whose long-term mean is <var>α</var>. The first-order accumulator emits only 0 or 1. A MASH 1-1-1 combines three accumulator carries and emits a multibit sequence.</p>
      <p><b>The difference is noise shaping.</b> For the accumulator, the quantisation error has one factor of (1 − <var>z</var><sup>−1</sup>). The MASH cancels its first two internal errors and leaves three factors. Its low-frequency error is therefore much smaller, in exchange for larger cycle-to-cycle divider changes.</p>
      <p><b>Neither sequence here is dithered.</b> A constant rational <var>α</var> produces a deterministic, often periodic pattern, so tones can remain. Making a frequency-control word odd only changes that period; it does not create random dither.</p>
    </Notes>
  </header>

  <section class="facts" aria-label="Divider comparison">
    <div><span class="label">Requested mean</span><b>{alpha.toFixed(3)}</b><small>fractional divider ratio</small></div>
    <div><span class="label">Accumulator mean</span><b>{nf(accMean, 5)}</b><small>word range 0 … 1</small></div>
    <div><span class="label">MASH mean</span><b>{nf(mashMean, 5)}</b><small>word range {mashMin} … {mashMax}</small></div>
    <div><span class="label">Dither</span><b>none</b><small>both traces are deterministic</small></div>
  </section>

  <section class="compare">
    <div class="chart">
      <div class="cap"><span class="left"><span class="label">Divider word</span><span>the integer correction applied each reference cycle</span></span><span><span class="key k1"></span>first order · <span class="key k2"></span>third order</span></div>
      <DividerWordChart acc={acc.y} mash={mash.y} {hover} onhover={(i) => (hover = i)} label="Divider words from a first-order accumulator and a MASH 1-1-1" />
    </div>
    <div class="chart">
      <div class="cap"><span class="left"><span class="label">Accumulated divider error</span><span>the phase excursion presented to the PLL</span></span><span>Σ(<var>y</var> − <var>α</var>)</span></div>
      <DividerErrorChart acc={acc.phase} mash={mash.phase} {hover} onhover={(i) => (hover = i)} label="Accumulated divider error from a first-order accumulator and a MASH 1-1-1" />
    </div>
  </section>
</main>

<style>
  .page { grid-template-rows: auto auto minmax(0, 1fr); }
  .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-block: 1px solid var(--rule); }
  .facts > div { min-width: 0; padding: 9px 16px 10px; display: grid; grid-template-columns: max-content 1fr; align-items: baseline; gap: 1px 12px; }
  .facts > div + div { border-left: 1px solid var(--rule); }
  .facts b { justify-self: end; font: 500 17px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .facts small { grid-column: 1 / -1; color: var(--ink-3); font-size: 11.5px; white-space: nowrap; }
  .compare { --rows: minmax(0, 1fr); }
  @media (max-width: 900px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .facts > div:nth-child(3) { border-left: 0; border-top: 1px solid var(--rule); } .facts > div:nth-child(4) { border-top: 1px solid var(--rule); } }
  @media (max-width: 520px) { .facts { grid-template-columns: 1fr; } .facts > div:nth-child(n) { border-left: 0; } .facts > div:nth-child(n + 2) { border-top: 1px solid var(--rule); } }
</style>

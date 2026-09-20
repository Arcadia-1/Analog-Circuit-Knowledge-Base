<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import { nf } from '../../lib/format';
  import { LENGTHS, RUNS, sweepStream, type LengthRow } from './model';
  import StabilityChart from './StabilityChart.svelte';

  let index = $state(LENGTHS.indexOf(4096));
  let hover = $state<number | null>(null);
  const n = $derived(LENGTHS[index]);
  let rows = $state<LengthRow[]>([]);
  let running = $state(true);
  const selected = $derived(rows.find((row) => row.n === n) ?? null);
  const recommended = $derived(rows.find((row) => row.sndr.sigma <= 0.1) ?? null);

  $effect(() => {
    const steps = sweepStream();
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
    <a class="crumb" href="/#lessons">← All lessons</a>
    <h1>Measurement repeatability</h1>
    <p class="sub">Record length does not improve the ADC's SNDR; it reduces how much one reported reading wanders.</p>
    <div class="pick">
      <Range id="repeat-n" min={0} max={LENGTHS.length - 1} step={1} output="{n} points" bind:value={index}>Record</Range>
    </div>
    <Notes>
      <p><b>A measurement is an estimate.</b> Fresh noise changes the energy assigned to every FFT bin, so two captures of the same converter do not return exactly the same SNDR. The curve is the standard deviation across {RUNS} independent captures at each record length.</p>
      <p><b>Longer records reduce uncertainty.</b> More independent noise samples make the summed noise power steadier. The mean SNDR remains near the same value while its run-to-run spread shrinks roughly with 1/√<var>N</var>.</p>
      <p><b>Choose a tolerance first.</b> This experiment marks ±0.1 dB as the acceptance band. Select the shortest record whose spread lies inside it. That is a repeatability requirement, separate from the frequency-resolution and spur-visibility requirements in <a href="/adc/how-long-a-record/">Choosing FFT record length</a>.</p>
    </Notes>
  </header>

  <section class="facts" aria-label="Repeatability result">
    <div><span class="label">Selected record</span><b>{n.toLocaleString('en')}</b><small>samples per capture</small></div>
    <div><span class="label">One-capture spread</span><b>{selected ? `±${nf(selected.sndr.sigma, 2)} dB` : 'measuring…'}</b><small>one standard deviation</small></div>
    <div><span class="label">First below ±0.1 dB</span><b>{recommended ? recommended.n.toLocaleString('en') : running ? 'measuring…' : 'none'}</b><small>for this noise model</small></div>
  </section>

  <section class="compare">
    <div class="chart wide">
      <div class="cap"><span class="left"><span class="label">Run-to-run SNDR spread</span><span>same converter and stimulus, fresh noise each capture</span></span><span>{RUNS} captures per point{running ? ' · measuring' : ''}</span></div>
      <StabilityChart {rows} at={n} {hover} onhover={(i) => (hover = i)} label="Standard deviation of SNDR across repeated captures against record length" />
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

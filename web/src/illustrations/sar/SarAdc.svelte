<script lang="ts">
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import ValueField from '../../components/ui/ValueField.svelte';
  import { nf } from '../../lib/format';
  import { gaussians } from '../../lib/rng';
  import { clamp } from '../../lib/scale';
  import AdcSpectrumChart from './AdcSpectrumChart.svelte';
  import CdacDiagram from './CdacDiagram.svelte';
  import InputRuler from './InputRuler.svelte';
  import { binaryMoves, convert, mismatchFor, redundancy, redundantMoves, sineTest, type Step } from './model';
  import ResidueChart from './ResidueChart.svelte';

  let n = $state(8);
  let vin = $state(0.7434);
  let settling = $state(0.05);
  let noiseLsb = $state(0.1);
  let mismatch = $state(0);
  let seed = $state(1);
  let shown = $state(Infinity);
  let playing = $state(false);
  let hoverK = $state<number | null>(null);
  let hoverBin = $state<number | null>(null);

  const red = $derived(redundantMoves(n));
  const archs = $derived([
    { moves: binaryMoves(n), seed: 101 },
    { moves: red.moves, seed: 202 },
  ]);
  const slots = $derived(red.moves.length + 1);
  const at = $derived(Math.min(shown, slots));
  const imp = $derived({ settling, noiseLsb, mismatch });
  const x = $derived(vin * 2 ** n);
  const ideal = $derived(Math.floor(x));
  const noise = $derived(gaussians(32, seed));

  const results = $derived(
    archs.map(({ moves, seed: chip }) => {
      const dev = mismatch ? mismatchFor(moves, mismatch, chip) : null;
      const steps: Step[] = [];
      const code = convert(x, n, moves, imp, dev, noise, steps);
      return { moves, steps, code, test: sineTest(n, moves, imp, dev) };
    }),
  );

  function reset() {
    playing = false;
    shown = Infinity;
  }
  function step(d: number) {
    playing = false;
    shown = clamp(at + d, 0, slots);
  }
  function play() {
    if (!playing && at >= slots) shown = 0;
    playing = !playing;
  }
  $effect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (shown < slots) shown++;
      else playing = false;
    }, 520);
    return () => clearInterval(id);
  });

  const errText = (code: number) => (code === ideal ? null : `off by ${code > ideal ? '+' : '−'}${Math.abs(code - ideal)} LSB`);
</script>

{#snippet header(i: 0 | 1)}
  {@const r = results[i]}
  {@const err = errText(r.code)}
  <div class="head col{i + 1}">
    <div class="line">
      <div class="name-f">
        <div class="name"><span class="key k{i + 1}"></span><span>{i ? 'Redundant' : 'Binary'} SAR</span></div>
        <div class="formula"><var>s</var><sub><var>k</var>+1</sub> <span class="op">{i ? '≈' : '='}</span> <var>s</var><sub><var>k</var></sub> <span class="op">/</span> {i ? red.radix.toFixed(2) : 2}</div>
      </div>
      <span class="meta">{r.moves.length + 1} comparisons · {i ? `first step tolerates ±${redundancy(r.moves)[0]} LSB` : 'no redundancy'}</span>
    </div>
    <div class="line">
      <div class="readout">
        <span>code <span class="mono">{r.code}</span></span>
        <span>ideal <span class="mono">{ideal}</span></span>
        {#if err}<span class="chip off">{err}</span>{:else}<span class="chip">correct</span>{/if}
      </div>
    </div>
  </div>
{/snippet}

<main class="page">
  <header class="top">
    <a class="crumb" href="/">AMS Class</a>
    <h1>Binary vs redundant SAR</h1>
    <p class="sub">One sampled input, one comparator, one capacitor array. Only the step sizes differ.</p>
    <div class="pick">
      <span class="label" id="res-label">Resolution</span>
      <Segmented size="sm" mono label="Resolution in bits" options={[6, 8, 10, 12].map((b) => ({ value: b, label: String(b) }))} bind:value={() => n, (b) => { n = b; reset(); }} />
      <span class="unit">bits</span>
    </div>
    <Notes>
      <p><b>Conversion.</b> In LSB units the first comparison tests mid-scale, 2<sup><var>N</var>−1</sup>. After each decision the DAC moves up or down by the next step <var>s</var>; the output code is the last threshold plus the last bit, minus one.</p>
      <p><b>Binary SAR.</b> <var>N</var> comparisons, each step half the previous one, so any wrong decision is final.</p>
      <p><b>Redundant SAR.</b> <var>N</var> + ⌈<var>N</var>/6⌉ comparisons with integer steps shrinking by a radix of about 1.7 that still add up to the full scale. A decision wrong by up to 1 + (sum of later steps) − (this step) LSB is corrected by the comparisons that follow.</p>
      <p><b>Impairments.</b> DAC settling: the comparator sees the new level minus a fraction ε of the last step. Comparator noise: Gaussian per comparison. Capacitor mismatch: each step's capacitor (2<var>s</var> unit capacitors) deviates by σ/√(2<var>s</var>), fixed per chip. The drawn conversion uses one noise sample; the spectra draw new noise for every comparison.</p>
      <p><b>Sine test.</b> 4096 conversions of a −0.5 dBFS sine with 409 cycles (coherent), rectangular window. ENOB = (SNDR − 1.76) / 6.02.</p>
    </Notes>
  </header>

  <section class="tuner" aria-label="Input voltage">
    <div class="tuner-left">
      <label class="label" for="vin-num">Input</label>
      <ValueField id="vin-num" value={vin} digits={4} unit="V" step={1 / 2 ** n} onchange={(v) => { vin = clamp(v, 0, 1); reset(); }} title="Type a voltage between 0 and 1 V, or use ↑ ↓ to step one LSB (Shift: ten)" />
      <div class="transport">
        <button type="button" onclick={() => step(-1)} disabled={at === 0} aria-label="Previous comparison">‹</button>
        <button type="button" onclick={() => step(1)} disabled={at >= slots} aria-label="Next comparison">›</button>
        <button type="button" class="play" onclick={play}>{playing ? 'Pause' : 'Play'}</button>
        <span class="mono count">{at}/{slots}</span>
        {#if noiseLsb > 0}<button type="button" onclick={() => seed++} title="Draw a new comparator-noise sample for this conversion">New noise</button>{/if}
      </div>
    </div>
    <InputRuler {vin} {n} codeA={results[0].code} codeB={results[1].code} onchange={(v) => { vin = v; reset(); }} />
  </section>

  <section class="compare">
    <div class="imp">
      <span class="label">Impairments, same for both</span>
      <Range id="settling" min={0} max={0.12} step={0.005} output="{nf(settling * 100, 1)} %" bind:value={settling}>DAC settling error</Range>
      <Range id="noise" min={0} max={1} step={0.05} output="{nf(noiseLsb, 2)} LSB" bind:value={noiseLsb}>Comparator noise</Range>
      <Range id="mismatch" min={0} max={0.02} step={0.001} output="{nf(mismatch * 100, 1)} %" bind:value={mismatch}>Capacitor mismatch</Range>
    </div>

    {@render header(0)}
    {@render header(1)}
    {#each results as r, i (i)}
      <div class="col{i + 1}"><CdacDiagram moves={r.moves} steps={r.steps} shown={at} series={i ? 2 : 1} label="{i ? 'Redundant' : 'Binary'} capacitor DAC switch states" /></div>
    {/each}
    {#each results as r, i (i)}
      <div class="chart">
        <div class="cap">
          <span class="left"><span class="label"><span class="tag">{i ? 'Redundant' : 'Binary'}</span>Successive approximation</span><span>residue, log scale</span></span>
          <span class="keys"><i class="sw"></i>reachable<i class="sw lost"></i>V<sub>in</sub> lost<i class="sw wrong"></i>wrong bit</span>
        </div>
        <ResidueChart steps={r.steps} {x} {n} {slots} shown={at} series={i ? 2 : 1} hover={hoverK} onhover={(k) => (hoverK = k)} label="{i ? 'Redundant' : 'Binary'} SAR residue per comparison" />
      </div>
    {/each}
    {#each results as r, i (i)}
      <div class="chart">
        <div class="cap">
          <span class="left"><span class="label"><span class="tag">{i ? 'Redundant' : 'Binary'}</span>Sine test</span><span>4096 conversions</span></span>
          <span>SNDR <b>{nf(r.test.sndr, 1)} dB</b> · ENOB <b>{nf(r.test.enob, 2)}</b> · SFDR <b>{nf(r.test.sfdr, 1)} dB</b></span>
        </div>
        <AdcSpectrumChart test={r.test} {n} series={i ? 2 : 1} hover={hoverBin} onhover={(b) => (hoverBin = b)} label="{i ? 'Redundant' : 'Binary'} SAR output spectrum" />
      </div>
    {/each}
  </section>
</main>

<style>
  .compare { --rows: auto auto 78px minmax(0, 1.1fr) minmax(0, 1fr); padding-top: 10px; }
  .imp { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 28px; }
  .imp .label { color: var(--ink-3); }
  .meta { font-size: 12.5px; color: var(--ink-3); }
  .chip.off { color: var(--bad); box-shadow: inset 0 0 0 1px var(--bad); background: transparent; }
  .transport { display: flex; align-items: center; gap: 6px; }
  .transport button { font: 500 13px/1 var(--sans); color: var(--ink-2); background: var(--plot); border: 1px solid var(--rule); border-radius: 7px; padding: 5px 10px; min-width: 30px; cursor: pointer; }
  .transport button:hover:not(:disabled) { color: var(--ink); border-color: var(--ink-3); }
  .transport button:disabled { opacity: 0.45; cursor: default; }
  .transport .play { min-width: 58px; }
  .count { font-size: 12.5px; color: var(--ink-3); min-width: 4ch; }
  .keys { display: flex; align-items: center; gap: 5px; color: var(--ink-3); }
  .keys i { display: inline-block; margin-left: 9px; }
  .sw { width: 8px; height: 11px; border-radius: 2px; background: var(--chip); }
  .sw.lost { background: color-mix(in srgb, var(--bad) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bad) 60%, transparent); }
  .sw.wrong { width: 9px; height: 9px; border-radius: 50%; background: transparent; box-shadow: inset 0 0 0 1.5px var(--bad); }
</style>

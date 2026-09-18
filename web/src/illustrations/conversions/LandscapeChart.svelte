<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { jitterLimit, snrToEnob, thermalLimit } from '../../lib/units';
  import { enobAtWalden, FOM_W, type Part } from './model';

  /**
   * Where a converter sits: ENOB against sampling rate, with a line for each Walden figure of merit at the power it
   * is given, the ENOB its clock leaves at a Nyquist-rate input, and the ceiling its sampling capacitor puts on it.
   */
  let { part, enob, jitter, cap, hover, onhover, label }: {
    part: Part;
    enob: number;
    /** clock jitter, s rms */
    jitter: number;
    /** sampling capacitance, pF */
    cap: number;
    hover: number | null;
    onhover: (fs: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40, LO = 6, HI = 11, TOP = 24;
  const decades = Array.from({ length: HI - LO + 1 }, (_, i) => LO + i);
  const gain = $derived(part.osr > 1 ? 10 * Math.log10(part.osr) : 0);
  const ceiling = $derived(snrToEnob(thermalLimit(cap, part.vfs) + gain));

  function geo(W: number, H: number) {
    const X1 = W - 30, Y0 = 8, Y1 = H - 20;
    const sx = (fs: number) => X0 + ((Math.log10(fs) - LO) / (HI - LO)) * (X1 - X0);
    const sy = (bits: number) => Y0 + ((TOP - clamp(bits, 0, TOP)) / TOP) * (Y1 - Y0);
    const ends = [10 ** LO, 10 ** HI];
    const line = (f: (fs: number) => number) => ends.map((fs, i) => `${i ? 'L' : 'M'}${sx(fs).toFixed(1)},${sy(f(fs)).toFixed(1)}`).join('');
    const grid = [0, 4, 8, 12, 16, 20, 24];
    // a line that has run off the bottom of the plot shares its label's place with the next one, so keep them apart
    const fom = FOM_W.map((f) => ({ fom: f, d: line((fs) => enobAtWalden(part.power, f, fs)), y: sy(enobAtWalden(part.power, f, 10 ** HI)) }));
    for (let i = fom.length - 2; i >= 0; i--) fom[i].y = Math.min(fom[i].y, fom[i + 1].y - 13);
    return { X1, Y0, Y1, sx, sy, grid, fom, clock: line((fs) => snrToEnob(jitterLimit(fs / 2, jitter) + gain)) };
  }

  function move(px: number, W: number) {
    const X1 = W - 30;
    onhover(px >= X0 && px <= X1 ? 10 ** (LO + ((px - X0) / (X1 - X0)) * (HI - LO)) : null);
  }

  const fj = (fom: number) => (fom * 1e15 >= 1000 ? `${nf(fom * 1e12, 0)} pJ` : `${nf(fom * 1e15, 0)} fJ`);
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each decades as d, i (d)}
      <text class="tx" x={g.sx(10 ** d)} y={height - 5} text-anchor={i === 0 ? 'start' : i === decades.length - 1 ? 'end' : 'middle'}>
        {d >= 9 ? `${10 ** (d - 9)} G` : `${10 ** (d - 6)} M`}
      </text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 26}>ENOB, bits</text>
    <line class="wall" x1={X0} y1={g.sy(ceiling)} x2={g.X1} y2={g.sy(ceiling)} />
    <text class="tx halo" x={g.X1} y={g.sy(ceiling) - 5} text-anchor="end">kT/C</text>
    <path class="clock" d={g.clock} />
    {#each g.fom as f (f.fom)}
      <path class="c1 fom" d={f.d} />
      <text class="tx halo" x={g.X1 + 4} y={f.y} dominant-baseline="central">{fj(f.fom)}</text>
    {/each}
    <circle class="f2" cx={g.sx(part.fs)} cy={g.sy(enob)} r="6" />
    <circle class="ring" cx={g.sx(part.fs)} cy={g.sy(enob)} r="10" />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(enobAtWalden(part.power, FOM_W[0], hover))}
        {width}
        text="at {freqText(hover)}, {nf(part.power * 1e3, 3)} mW buys {nf(enobAtWalden(part.power, FOM_W[0], hover), 1)} bits at {fj(FOM_W[0])} · the clock allows {nf(snrToEnob(jitterLimit(hover / 2, jitter) + gain), 1)}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .fom { stroke-width: 1.5; opacity: 0.8; }
  .clock { stroke: var(--bad); stroke-width: 1.8; stroke-dasharray: 7 4; fill: none; }
  .wall { stroke: var(--ink-3); stroke-width: 1.3; stroke-dasharray: 3 3; }
  .ring { fill: none; stroke: var(--s2); stroke-width: 1.6; opacity: 0.55; }
</style>

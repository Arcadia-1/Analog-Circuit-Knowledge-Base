<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { FOM_S, sndrAtSchreier, type Part } from './model';

  /** The other figure of merit: SNDR against the bandwidth it is delivered over, a line for each Schreier number. */
  let { part, bw, hover, onhover, label }: {
    part: Part;
    /** the converter's own noise bandwidth, Hz */
    bw: number;
    hover: number | null;
    onhover: (bw: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40, LO = 4, HI = 10, TOP = 140;
  const decades = Array.from({ length: HI - LO + 1 }, (_, i) => LO + i);

  function geo(W: number, H: number) {
    const X1 = W - 34, Y0 = 8, Y1 = H - 20;
    const sx = (hz: number) => X0 + ((Math.log10(hz) - LO) / (HI - LO)) * (X1 - X0);
    const sy = (db: number) => Y0 + ((TOP - clamp(db, 0, TOP)) / TOP) * (Y1 - Y0);
    const ends = [10 ** LO, 10 ** HI];
    const grid = [0, 20, 40, 60, 80, 100, 120, 140];
    return {
      X1, Y0, Y1, sx, sy, grid,
      fom: FOM_S.map((f) => ({
        fom: f,
        d: ends.map((hz, i) => `${i ? 'L' : 'M'}${sx(hz).toFixed(1)},${sy(sndrAtSchreier(part.power, f, hz)).toFixed(1)}`).join(''),
        y: sy(sndrAtSchreier(part.power, f, 10 ** HI)),
      })),
    };
  }

  function move(px: number, W: number) {
    const X1 = W - 34;
    onhover(px >= X0 && px <= X1 ? 10 ** (LO + ((px - X0) / (X1 - X0)) * (HI - LO)) : null);
  }
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
        {d >= 9 ? `${10 ** (d - 9)} G` : d >= 6 ? `${10 ** (d - 6)} M` : `${10 ** (d - 3)} k`}
      </text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 26}>SNDR, dB</text>
    {#each g.fom as f (f.fom)}
      <path class="c1 fom" d={f.d} />
      <text class="tx halo" x={g.X1 + 4} y={f.y} dominant-baseline="central">{f.fom}</text>
    {/each}
    <circle class="f2" cx={g.sx(bw)} cy={g.sy(part.sndr)} r="6" />
    <circle class="ring" cx={g.sx(bw)} cy={g.sy(part.sndr)} r="10" />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(sndrAtSchreier(part.power, FOM_S[1], hover))}
        {width}
        text="over {freqText(hover)}, {nf(part.power * 1e3, 3)} mW buys {nf(sndrAtSchreier(part.power, FOM_S[1], hover), 1)} dB at 170 dB · {nf(sndrAtSchreier(part.power, FOM_S[3], hover), 1)} dB at 190"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .fom { stroke-width: 1.5; opacity: 0.8; }
  .ring { fill: none; stroke: var(--s2); stroke-width: 1.6; opacity: 0.55; }
</style>

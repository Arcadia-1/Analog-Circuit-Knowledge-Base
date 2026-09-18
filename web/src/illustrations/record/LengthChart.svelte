<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { LENGTHS, type LengthRow } from './model';

  /**
   * exp_s13: SFDR and SNDR against record length. The band is the range the Monte Carlo captures covered and the line
   * their mean, so the width of the band is what a single capture would have cost you.
   */
  let { rows, at, hd3, hover, onhover, label }: {
    rows: LengthRow[];
    /** the length the page is showing a spectrum of */
    at: number;
    /** the harmonic that is really there, dBc, as a floor the SFDR cannot climb past */
    hd3: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;
  const LO = Math.log2(LENGTHS[0]), HI = Math.log2(LENGTHS[LENGTHS.length - 1]);

  function geo(W: number, H: number) {
    const X1 = W - 10, Y0 = 8, Y1 = H - 20;
    const values = rows.flatMap((r) => [r.sfdr.max, r.sfdr.min, r.sndr.max, r.sndr.min, -hd3]);
    const lo = 10 * Math.floor(Math.min(...values, 50) / 10), hi = 10 * Math.ceil(Math.max(...values, 60) / 10);
    const sx = (n: number) => X0 + ((Math.log2(n) - LO) / (HI - LO)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (Y1 - Y0);
    const line = (pick: (r: LengthRow) => number) =>
      rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.n).toFixed(1)},${sy(pick(r)).toFixed(1)}`).join('');
    const band = (pick: (r: LengthRow) => { min: number; max: number }) => {
      if (rows.length < 2) return '';
      const top = rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.n).toFixed(1)},${sy(pick(r).max).toFixed(1)}`).join('');
      const bot = rows.map((r) => `L${sx(r.n).toFixed(1)},${sy(pick(r).min).toFixed(1)}`).reverse().join('');
      return `${top}${bot}Z`;
    };
    const grid: number[] = [];
    for (let v = lo; v <= hi; v += hi - lo > 50 ? 10 : 5) grid.push(v);
    return {
      X1, Y0, Y1, sx, sy, grid,
      sfdr: line((r) => r.sfdr.mean),
      sndr: line((r) => r.sndr.mean),
      sfdrBand: band((r) => r.sfdr),
      sndrBand: band((r) => r.sndr),
    };
  }

  function move(px: number, W: number) {
    const X1 = W - 10;
    if (px < X0 - 6 || px > X1 + 6 || !rows.length) return onhover(null);
    const want = LO + ((px - X0) / (X1 - X0)) * (HI - LO);
    let best = 0;
    rows.forEach((r, i) => {
      if (Math.abs(Math.log2(r.n) - want) < Math.abs(Math.log2(rows[best].n) - want)) best = i;
    });
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each LENGTHS as n, i (n)}
      <text class="tx" x={g.sx(n)} y={height - 5} text-anchor={i === 0 ? 'start' : i === LENGTHS.length - 1 ? 'end' : 'middle'}>
        {n >= 1024 ? `${n / 1024}k` : n}
      </text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 24}>dBc</text>
    <line class="guide" x1={g.sx(at)} y1={g.Y0} x2={g.sx(at)} y2={g.Y1} />
    <line class="floor" x1={X0} y1={g.sy(-hd3)} x2={g.X1} y2={g.sy(-hd3)} />
    <text class="tx halo" x={g.X1 - 4} y={g.sy(-hd3) - 6} text-anchor="end">the harmonic that is really there</text>
    {#if rows.length > 1}
      <path class="a1" d={g.sfdrBand} />
      <path class="a2" d={g.sndrBand} />
      <path class="c2" stroke-width="2" d={g.sndr} />
      <path class="c1" stroke-width="2.2" d={g.sfdr} />
    {/if}
    {#each rows as r, i (r.n)}
      <circle class="f1" cx={g.sx(r.n)} cy={g.sy(r.sfdr.mean)} r={i === hover ? 4.5 : 2.6} />
      <circle class="f2" cx={g.sx(r.n)} cy={g.sy(r.sndr.mean)} r={i === hover ? 4.5 : 2.6} />
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && rows[hover]}
      {@const g = geo(width, height)}
      {@const r = rows[hover]}
      <Tip
        x={g.sx(r.n)}
        y={g.sy(r.sfdr.mean)}
        {width}
        text="{r.n} points, bin {r.bin} · SFDR {nf(r.sfdr.mean, 1)} ± {nf(r.sfdr.sigma, 2)} · SNDR {nf(r.sndr.mean, 1)} ± {nf(r.sndr.sigma, 2)} dBc"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .floor { stroke: var(--ink-3); stroke-width: 1.3; stroke-dasharray: 6 4; }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { LENGTHS, type LengthRow } from './model';

  /** The run-to-run standard deviation of one SNDR measurement. A log y-axis keeps the useful 0.1 dB region legible. */
  let { rows, at, hover, onhover, label }: {
    rows: LengthRow[];
    at: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 43;
  const LO_X = Math.log2(LENGTHS[0]), HI_X = Math.log2(LENGTHS[LENGTHS.length - 1]);
  const GRID = [0.05, 0.1, 0.2, 0.5, 1, 2, 5];

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const values = rows.map((r) => r.sndr.sigma).filter((v) => v > 0);
    const lo = Math.min(0.05, ...values), hi = Math.max(5, ...values);
    const l0 = Math.log10(lo), l1 = Math.log10(hi);
    const sx = (n: number) => X0 + ((Math.log2(n) - LO_X) / (HI_X - LO_X)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((l1 - Math.log10(Math.max(v, lo))) / (l1 - l0)) * (Y1 - Y0);
    const line = rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.n).toFixed(1)},${sy(r.sndr.sigma).toFixed(1)}`).join('');
    const grid = GRID.filter((v) => v >= lo && v <= hi);
    const ticks = LENGTHS.filter((_, i) => i % 2 === 0 || i === LENGTHS.length - 1);
    return { X1, Y0, Y1, sx, sy, line, grid, ticks };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    if (px < X0 - 6 || px > X1 + 6 || !rows.length) return onhover(null);
    const want = LO_X + ((px - X0) / (X1 - X0)) * (HI_X - LO_X);
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
    <rect class="good" x={X0} y={g.sy(0.1)} width={g.X1 - X0} height={g.Y1 - g.sy(0.1)} />
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each g.ticks as n, i (n)}
      <text class="tx" x={g.sx(n)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{n >= 1024 ? `${n / 1024}k` : n}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>± dB, one sigma</text>
    <text class="tx halo" x={g.X1 - 4} y={g.sy(0.1) - 6} text-anchor="end">within 0.1 dB</text>
    <line class="guide" x1={g.sx(at)} y1={g.Y0} x2={g.sx(at)} y2={g.Y1} />
    {#if rows.length > 1}<path class="c2" stroke-width="2.2" d={g.line} />{/if}
    {#each rows as r, i (r.n)}
      <circle class="f2" cx={g.sx(r.n)} cy={g.sy(r.sndr.sigma)} r={i === hover ? 4.5 : 2.8} />
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && rows[hover]}
      {@const g = geo(width, height)}
      {@const r = rows[hover]}
      <Tip x={g.sx(r.n)} y={g.sy(r.sndr.sigma)} {width} text="{r.n} points · SNDR {nf(r.sndr.mean, 1)} dB · one-capture spread ±{nf(r.sndr.sigma, 2)} dB" />
    {/if}
  {/snippet}
</Plot>

<style>
  .good { fill: var(--s1-soft); }
</style>

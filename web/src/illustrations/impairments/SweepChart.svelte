<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { strengthText, type Kind, type Sweep } from './model';

  /**
   * SNDR and SNR against the strength of one impairment, with the SNR that impairment alone would allow dashed behind
   * them. The strengths are spaced evenly rather than by value, so a decade reads as a decade.
   */
  let { sweep, kind, at, stale, hover, onhover, label }: {
    sweep: Sweep;
    kind: Kind;
    /** index of the strength the page is showing */
    at: number;
    /** true while the controls have moved on and the sweep has not caught up */
    stale: boolean;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;
  const m = $derived(sweep.strengths.length);

  function geo(W: number, H: number) {
    const X1 = W - 10, Y0 = 8, Y1 = H - 20;
    const limits = sweep.limit.filter((v): v is number => v !== null);
    const values = [...sweep.sndr, ...sweep.snr, ...limits.filter((v) => v < Math.max(...sweep.sndr) + 25)];
    const lo = 10 * Math.floor(Math.min(...values) / 10), hi = 10 * Math.ceil(Math.max(...values) / 10);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (Y1 - Y0);
    const sx = (i: number) => X0 + (m < 2 ? 0.5 : clamp(i, 0, m - 1) / (m - 1)) * (X1 - X0);
    const line = (a: (number | null)[]) =>
      a.map((v, i) => (v === null ? '' : `${i && a[i - 1] !== null ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`)).join('');
    const grid: number[] = [];
    for (let v = lo; v <= hi; v += hi - lo > 70 ? 20 : 10) grid.push(v);
    // every strength when they fit, every other one when they do not
    const every = (X1 - X0) / m > 46 ? 1 : 2;
    return { X1, Y0, Y1, sx, sy, grid, every, sndr: line(sweep.sndr), snr: line(sweep.snr), limit: line(sweep.limit) };
  }

  function move(px: number, W: number) {
    const X1 = W - 10;
    onhover(px >= X0 - 6 && px <= X1 + 6 ? clamp(Math.round(((px - X0) / (X1 - X0)) * (m - 1)), 0, m - 1) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each sweep.strengths as s, i (i)}
      {#if i % g.every === 0}
        <text class="tx" x={g.sx(i)} y={height - 5} text-anchor={i === 0 ? 'start' : i === m - 1 ? 'end' : 'middle'}>{strengthText(kind, s, false)}</text>
      {/if}
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>dB</text>
    <line class="guide" x1={g.sx(at)} y1={g.Y0} x2={g.sx(at)} y2={g.Y1} />
    <g class:stale>
      {#if g.limit}<path class="lim" d={g.limit} />{/if}
      <path class="c2" stroke-width="1.6" d={g.snr} />
      <path class="c1" stroke-width="2.2" d={g.sndr} />
      {#each sweep.sndr as v, i (i)}
        <circle class="f1" cx={g.sx(i)} cy={g.sy(v)} r={i === at ? 4.5 : 2.6} />
      {/each}
    </g>
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(sweep.sndr[hover])}
        {width}
        text="{strengthText(kind, sweep.strengths[hover])} · SNDR {nf(sweep.sndr[hover], 1)} dB · SNR {nf(sweep.snr[hover], 1)} dB{sweep.limit[hover] === null ? '' : ` · allowed ${nf(sweep.limit[hover]!, 1)} dB`}{sweep.recovered ? ` · read back ${nf(sweep.recovered[hover] * 1e15, 1)} fs` : ''}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .lim { stroke: var(--ink-3); stroke-width: 1.4; stroke-dasharray: 6 4; fill: none; }
  .stale { opacity: 0.35; }
</style>

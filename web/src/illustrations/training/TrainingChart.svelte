<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { LENGTHS, type Band } from './model';

  /**
   * exp_d18: what a calibration is worth against the number of samples it was solved from. The solid band is a capture
   * the weights have never seen; the dashed one is the capture they were solved from, and the gap between them is
   * everything a short training record promises and cannot keep.
   */
  let { rows, at, raw, hover, onhover, label }: {
    rows: Band[];
    /** the training length the page is showing in detail */
    at: number;
    /** what the same chips read before any calibration: worst, middle, best */
    raw: [number, number, number];
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40, TOP = 18;
  const LO = Math.log2(LENGTHS[0]), HI = Math.log2(LENGTHS[LENGTHS.length - 1]);

  function geo(W: number, H: number) {
    const X1 = W - 10, Y0 = 8, Y1 = H - 20;
    const floor = Math.min(raw[0], ...rows.map((r) => r.test[0]));
    const lo = Math.max(0, Math.floor(Math.min(floor, 13)));
    const sx = (n: number) => X0 + ((Math.log2(n) - LO) / (HI - LO)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((TOP - clamp(v, lo, TOP)) / (TOP - lo)) * (Y1 - Y0);
    const line = (pick: (r: Band) => number) => rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.n).toFixed(1)},${sy(pick(r)).toFixed(1)}`).join('');
    const band = (pick: (r: Band) => [number, number, number]) => {
      if (rows.length < 2) return '';
      const top = rows.map((r, i) => `${i ? 'L' : 'M'}${sx(r.n).toFixed(1)},${sy(pick(r)[2]).toFixed(1)}`).join('');
      const bot = rows.map((r) => `L${sx(r.n).toFixed(1)},${sy(pick(r)[0]).toFixed(1)}`).reverse().join('');
      return `${top}${bot}Z`;
    };
    const grid: number[] = [];
    for (let v = Math.ceil(lo); v <= TOP; v += TOP - lo > 8 ? 2 : 1) grid.push(v);
    // a fit that has swallowed its training capture can read thirty bits on it; say so rather than silently clipping
    const over = rows.filter((r) => r.own[2] > TOP).map((r) => ({ x: sx(r.n) + 14, text: `${Math.round(r.own[2])} bits` }));
    return {
      X1, Y0, Y1, sx, sy, grid, lo, over,
      test: line((r) => r.test[1]),
      own: line((r) => r.own[1]),
      testBand: band((r) => r.test),
      ownBand: band((r) => r.own),
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
      <text class="tx" x={g.sx(n)} y={height - 5} text-anchor={i === 0 ? 'start' : i === LENGTHS.length - 1 ? 'end' : 'middle'}>{n}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 24}>ENOB, bits</text>
    <line class="guide" x1={g.sx(at)} y1={g.Y0} x2={g.sx(at)} y2={g.Y1} />
    <line class="raw" x1={X0} y1={g.sy(raw[1])} x2={g.X1} y2={g.sy(raw[1])} />
    <text class="tx halo" x={g.X1 - 4} y={g.sy(raw[1]) - 6} text-anchor="end">before any calibration</text>
    {#if rows.length > 1}
      <path class="a2" d={g.ownBand} />
      <path class="a1" d={g.testBand} />
      <path class="c2 own" stroke-width="1.8" d={g.own} />
      <path class="c1" stroke-width="2.4" d={g.test} />
    {/if}
    {#each rows as r, i (r.n)}
      <circle class="f1" cx={g.sx(r.n)} cy={g.sy(r.test[1])} r={i === hover ? 4.5 : 2.8} />
    {/each}
    {#each g.over as o, i (i)}
      <text class="tx2 halo over" x={o.x} y={g.Y0 + 10} text-anchor="start">↑ {o.text}</text>
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && rows[hover]}
      {@const g = geo(width, height)}
      {@const r = rows[hover]}
      <Tip
        x={g.sx(r.n)}
        y={g.sy(r.test[1])}
        {width}
        text="{r.n} samples, bin {r.bin} · unseen capture {nf(r.test[1], 2)} bits ({nf(r.test[0], 2)} … {nf(r.test[2], 2)}) · its own {nf(r.own[1], 2)}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .own { stroke-dasharray: 6 4; }
  .raw { stroke: var(--ink-3); stroke-width: 1.3; stroke-dasharray: 3 3; }
  .over { fill: var(--s2); }
</style>

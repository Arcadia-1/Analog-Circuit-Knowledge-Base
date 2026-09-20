<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  let { x, y, xLabel, yLabel, label, line = false, series = 1, hover, onhover }: {
    x: Float64Array;
    y: Float64Array;
    xLabel: string;
    yLabel: string;
    label: string;
    line?: boolean;
    series?: 1 | 2;
    hover: number | null;
    onhover: (i: number | null) => void;
  } = $props();

  const X0 = 43;
  const range = $derived.by(() => {
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i < x.length; i++) {
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      xmin = Math.min(xmin, x[i]); xmax = Math.max(xmax, x[i]);
      ymin = Math.min(ymin, y[i]); ymax = Math.max(ymax, y[i]);
    }
    if (!(xmax > xmin)) { xmin -= 1; xmax += 1; }
    if (!(ymax > ymin)) { ymin -= 1; ymax += 1; }
    const xp = (xmax - xmin) * 0.05, yp = (ymax - ymin) * 0.09;
    return { xmin: xmin - xp, xmax: xmax + xp, ymin: ymin - yp, ymax: ymax + yp };
  });

  function geo(W: number, H: number) {
    const X1 = W - 7, Y0 = 8, Y1 = H - 20;
    const sx = (v: number) => X0 + ((v - range.xmin) / (range.xmax - range.xmin)) * (X1 - X0);
    const sy = (v: number) => Y1 - ((v - range.ymin) / (range.ymax - range.ymin)) * (Y1 - Y0);
    let d = '';
    for (let i = 0; i < x.length; i++) {
      if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
      d += line ? `${d ? 'L' : 'M'}${sx(x[i]).toFixed(1)},${sy(y[i]).toFixed(1)}` : `M${sx(x[i]).toFixed(1)},${sy(y[i]).toFixed(1)}h0.01`;
    }
    return { X1, Y0, Y1, sx, sy, d };
  }

  function move(px: number, W: number) {
    if (px < X0 || px > W - 7 || !x.length) return onhover(null);
    const target = range.xmin + ((px - X0) / (W - 7 - X0)) * (range.xmax - range.xmin);
    let best = 0;
    for (let i = 1; i < x.length; i++) if (Math.abs(x[i] - target) < Math.abs(x[best] - target)) best = i;
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, 0.5, 1] as f (f)}
      {@const xv = range.xmin + f * (range.xmax - range.xmin)}
      {@const yv = range.ymin + f * (range.ymax - range.ymin)}
      <line class="gr" x1={g.sx(xv)} y1={g.Y0} x2={g.sx(xv)} y2={g.Y1} />
      <line class="gr" x1={X0} y1={g.sy(yv)} x2={g.X1} y2={g.sy(yv)} />
      <text class="tx" x={g.sx(xv)} y={height - 5} text-anchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{nf(xv, Math.abs(xv) < 10 ? 2 : 0)}</text>
      <text class="tx" x={X0 - 6} y={g.sy(yv)} text-anchor="end" dominant-baseline="central">{nf(yv, Math.abs(yv) < 10 ? 2 : 0)}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 12}>{yLabel}</text>
    <text class="tx2 halo" x={g.X1 - 3} y={g.Y1 - 5} text-anchor="end">{xLabel}</text>
    <path class="c{series}" class:dots={!line} d={g.d} />
    {#if hover !== null && x[hover] !== undefined}<circle class="f{series} ring" cx={g.sx(x[hover])} cy={g.sy(y[hover])} r="3.5" />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && x[hover] !== undefined}
      {@const g = geo(width, height)}
      <Tip x={g.sx(x[hover])} y={g.sy(y[hover])} {width} text="{nf(x[hover], 3)} · {nf(y[hover], 3)}" />
    {/if}
  {/snippet}
</Plot>

<style>
  path { fill: none; stroke-width: 1.25; }
  .dots { stroke-width: 2.2; stroke-linecap: round; opacity: 0.48; }
</style>

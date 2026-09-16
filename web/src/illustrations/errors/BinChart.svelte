<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Bins } from './model';

  /** The residual binned along some axis: the mean of each bin as a line, its rms as a band behind it. */
  let { bins, span, ticks, unit, hover, onhover, label }: {
    bins: Bins;
    /** half-height of the y axis, LSB */
    span: number;
    ticks: { at: number; text: string }[];
    unit: string;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44;
  const k = $derived(bins.centers.length);

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 8, Y1 = H - 18;
    const lo = bins.centers[0], hi = bins.centers[k - 1];
    const sx = (v: number) => X0 + ((v - lo) / (hi - lo)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((span - clamp(v, -span, span)) / (2 * span)) * (Y1 - Y0);
    let top = '', bot = '', line = '';
    for (let b = 0; b < k; b++) {
      if (!Number.isFinite(bins.mean[b])) continue;
      const x = sx(bins.centers[b]);
      top += `${top ? 'L' : 'M'}${x},${sy(bins.rms[b])}`;
      bot = `L${x},${sy(-bins.rms[b])}` + bot;
      line += `${line ? 'L' : 'M'}${x},${sy(bins.mean[b])}`;
    }
    const step = span >= 8 ? 4 : span >= 4 ? 2 : span >= 2 ? 1 : span >= 0.8 ? 0.5 : 0.2;
    const grid: number[] = [];
    for (let v = -Math.floor(span / step) * step; v <= span; v += step) grid.push(Number(v.toFixed(2)));
    return { X1, Y0, Y1, sx, sy, band: top && `${top}${bot}Z`, line, grid };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 6 ? clamp(Math.round(((px - X0) / (W - 6 - X0)) * (k - 1)), 0, k - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" class:zero={v === 0} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each ticks as t, i (i)}
      <text class="tx" x={g.sx(t.at)} y={height - 4} text-anchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}>{t.text}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>{unit}</text>
    {#if g.band}<path class="a1" d={g.band} />{/if}
    <path class="c1" stroke-width="1.4" fill="none" d={g.line} />
    {#if hover !== null}<line class="cross" x1={g.sx(bins.centers[hover])} y1={g.Y0} x2={g.sx(bins.centers[hover])} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && Number.isFinite(bins.mean[hover])}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(bins.centers[hover])}
        y={g.sy(bins.mean[hover])}
        {width}
        text="mean {nf(bins.mean[hover], 3)} · rms {nf(bins.rms[hover], 3)} LSB · {bins.counts[hover]} samples"
      />
    {/if}
  {/snippet}
</Plot>

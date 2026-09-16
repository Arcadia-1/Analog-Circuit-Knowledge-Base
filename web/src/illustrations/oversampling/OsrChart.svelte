<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /** In-band SNDR against OSR: perfosr on this record, and white quantisation noise through ntfperf, dashed. */
  let { osrs, sweep, theory, at, hover, onhover, label }: {
    osrs: number[];
    sweep: number[];
    theory: number[];
    /** the OSR the page is showing */
    at: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44;

  function geo(W: number, H: number) {
    const X1 = W - 10, Y0 = 8, Y1 = H - 20;
    const values = [...sweep, ...theory];
    const lo = 20 * Math.floor(Math.min(...values) / 20), hi = 20 * Math.ceil(Math.max(...values) / 20);
    const last = osrs.length - 1;
    const sx = (i: number) => X0 + (i / last) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (Y1 - Y0);
    const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(v)}`).join('');
    const step = hi - lo > 120 ? 40 : 20;
    const grid: number[] = [];
    for (let v = lo; v <= hi; v += step) grid.push(v);
    return { X1, Y0, Y1, sx, sy, grid, measured: line(sweep), ideal: line(theory), i: osrs.indexOf(at) };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 - 6 && px <= W - 4 ? clamp(Math.round(((px - X0) / (W - 10 - X0)) * (osrs.length - 1)), 0, osrs.length - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each osrs as o, i (o)}
      <text class="tx" x={g.sx(i)} y={height - 5} text-anchor={i === 0 ? 'start' : i === osrs.length - 1 ? 'end' : 'middle'}>{o}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>in-band SNDR, dB, against OSR</text>
    <line class="guide" x1={g.sx(g.i)} y1={g.Y0} x2={g.sx(g.i)} y2={g.Y1} />
    <path class="ideal" d={g.ideal} />
    <path class="c1" stroke-width="2" d={g.measured} />
    {#each sweep as v, i (i)}
      <circle class={i === g.i ? 'f1 ring' : 'f1'} cx={g.sx(i)} cy={g.sy(v)} r={i === g.i ? 5 : 2.6} />
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(sweep[hover])} {width} text="OSR {osrs[hover]} · perfosr {nf(sweep[hover], 1)} dB · ntfperf {nf(theory[hover], 1)} dB" />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { fill: none; stroke: var(--ink-2); stroke-width: 1.2; stroke-dasharray: 5 4; }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /** Hits per code, with the density an ideal converter would have produced under the same test. */
  let { counts, ideal, n, hover, onhover, label }: {
    counts: Float64Array;
    ideal: Float64Array;
    n: number;
    hover: number | null;
    onhover: (code: number | null) => void;
    label: string;
  } = $props();

  const X0 = 42;
  const codes = $derived(2 ** n);
  // the end codes have no outer transition and collect everything beyond it, so they do not set the scale
  const top = $derived(1.15 * Math.max(...ideal.subarray(1, ideal.length - 1)) || 1);

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 8, Y1 = H - 18, cols = Math.max(1, Math.round(X1 - X0));
    const sx = (c: number) => X0 + (c / codes) * (X1 - X0);
    const sy = (v: number) => Y1 - (clamp(v, 0, top) / top) * (Y1 - Y0);
    const lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
    for (let k = 0; k < counts.length; k++) {
      const c = clamp(Math.floor(((k + 0.5) / counts.length) * cols), 0, cols - 1);
      if (counts[k] < lo[c]) lo[c] = counts[k];
      if (counts[k] > hi[c]) hi[c] = counts[k];
    }
    let bars = '';
    for (let c = 0; c < cols; c++) if (hi[c] > -Infinity) bars += `M${X0 + c + 0.5},${sy(hi[c])}V${Math.max(sy(lo[c]), sy(hi[c]) + 0.6)}`;
    let curve = '';
    for (let c = 0; c < cols; c++) {
      const k = clamp(Math.round(((c + 0.5) / cols) * ideal.length), 0, ideal.length - 1);
      curve += `${c ? 'L' : 'M'}${X0 + c + 0.5},${sy(ideal[k])}`;
    }
    const grid = [0.25, 0.5, 0.75, 1].map((f) => Math.round(f * top));
    const ticks = X1 - X0 < 280 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    return { X1, Y0, Y1, sx, sy, bars, curve, grid, ticks };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 6 ? clamp(Math.round(((px - X0) / (W - 6 - X0)) * codes), 0, codes - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each g.ticks as f (f)}
      <text class="tx" x={g.sx(f * codes)} y={height - 4} text-anchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{f * codes}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>hits per code</text>
    <path class="c1 bars" d={g.bars} />
    <path class="guide" fill="none" d={g.curve} />
    <line class="gr" x1={X0} y1={g.Y1} x2={g.X1} y2={g.Y1} />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(counts[hover])} {width} text="code {hover} · {counts[hover]} hits, {nf(ideal[hover], 1)} if ideal" />
    {/if}
  {/snippet}
</Plot>

<style>
  .bars { stroke-width: 1; opacity: 0.75; }
</style>

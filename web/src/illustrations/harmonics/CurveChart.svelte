<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp, niceSpan } from '../../lib/scale';

  /**
   * fit_static_nonlin: the bend the polynomial fit found between the ideal sine and what came out, against the bend
   * that was asked for. Both are drawn as the deviation from a straight line, which is what k2 and k3 describe.
   */
  let { curve, hover, onhover, label }: {
    curve: { x: Float64Array; measured: Float64Array; asked: Float64Array };
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 50;
  const span = $derived.by(() => {
    let peak = 0;
    for (let i = 0; i < curve.x.length; i++) peak = Math.max(peak, Math.abs(curve.measured[i]), Math.abs(curve.asked[i]));
    return Math.max(10, niceSpan(peak * 1e6));
  });

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 18, n = curve.x.length;
    const lo = curve.x[0], hi = curve.x[n - 1];
    const sx = (v: number) => X0 + ((v - lo) / (hi - lo)) * (X1 - X0);
    const sy = (uv: number) => (Y0 + Y1) / 2 - (clamp(uv, -span, span) / span) * ((Y1 - Y0) / 2);
    const path = (a: Float64Array) => Array.from(a, (v, i) => `${i ? 'L' : 'M'}${sx(curve.x[i]).toFixed(1)},${sy(v * 1e6).toFixed(1)}`).join('');
    return { X1, Y0, Y1, lo, hi, sx, sy, measured: path(curve.measured), asked: path(curve.asked) };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.round(((px - X0) / (W - 8 - X0)) * (curve.x.length - 1)), 0, curve.x.length - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [-1, -0.5, 0, 0.5, 1] as f (f)}
      <line class="gr" class:zero={f === 0} x1={X0} y1={g.sy(f * span)} x2={g.X1} y2={g.sy(f * span)} />
      <text class="tx" x={X0 - 6} y={g.sy(f * span)} text-anchor="end" dominant-baseline="central">{nf(f * span, 0)}</text>
    {/each}
    {#each [g.lo, (g.lo + g.hi) / 2, g.hi] as v, i (i)}
      <text class="tx" x={g.sx(v)} y={height - 4} text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{nf(v, 2)}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>µV off the straight line</text>
    <path class="asked" d={g.asked} />
    <path class="c1" stroke-width="2" d={g.measured} />
    {#if hover !== null}<line class="cross" x1={g.sx(curve.x[hover])} y1={g.Y0} x2={g.sx(curve.x[hover])} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(curve.x[hover])}
        y={g.sy(curve.measured[hover] * 1e6)}
        {width}
        text="{nf(curve.x[hover], 3)} V in · measured {nf(curve.measured[hover] * 1e6, 1)} µV off · asked for {nf(curve.asked[hover] * 1e6, 1)}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  /* drawn wide and behind, so agreement reads as a halo around the measured line and disagreement separates */
  .asked { stroke: var(--s2); stroke-width: 5; fill: none; opacity: 0.45; }
  .zero { stroke: var(--rule); }
</style>

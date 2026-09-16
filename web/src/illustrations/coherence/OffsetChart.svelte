<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /** ENOB against how far the tone sits from a bin, for the chosen window and for a rectangular one beside it. */
  let { curve, reference, at, ideal, hover, onhover, label }: {
    curve: Float64Array;
    reference: Float64Array;
    /** the offset the page is showing, −0.5 … 0.5 */
    at: number;
    ideal: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44;
  const k = $derived(curve.length);
  const offsetOf = (i: number) => -0.5 + i / (k - 1);

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 8, Y1 = H - 18;
    const top = Math.ceil(ideal + 1), bot = Math.min(0, Math.floor(Math.min(...curve, ...reference)));
    const sx = (o: number) => X0 + (o + 0.5) * (X1 - X0);
    const sy = (v: number) => Y0 + ((top - clamp(v, bot, top)) / (top - bot)) * (Y1 - Y0);
    const path = (a: Float64Array) => a.reduce((d, v, i) => `${d}${i ? 'L' : 'M'}${sx(offsetOf(i))},${sy(v)}`, '');
    const step = top - bot > 10 ? 4 : 2;
    const grid: number[] = [];
    for (let v = Math.ceil(bot / step) * step; v <= top; v += step) grid.push(v);
    return { X1, Y0, Y1, sx, sy, grid, main: path(curve), ref: path(reference) };
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
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each [-0.5, -0.25, 0, 0.25, 0.5] as o (o)}
      <line class="gr" x1={g.sx(o)} y1={g.Y0} x2={g.sx(o)} y2={g.Y1} />
      <text class="tx" x={g.sx(o)} y={height - 4} text-anchor={o === -0.5 ? 'start' : o === 0.5 ? 'end' : 'middle'}>{o}</text>
    {/each}
    <line class="guide" x1={X0} y1={g.sy(ideal)} x2={g.X1} y2={g.sy(ideal)} stroke-dasharray="4 3" />
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>ENOB vs offset from a bin</text>
    <path class="ghost" fill="none" stroke="var(--ghost)" stroke-width="1.2" d={g.ref} />
    <path class="c2" stroke-width="1.6" d={g.main} />
    <circle class="f2 ring" cx={g.sx(at)} cy={g.sy(curve[Math.round((at + 0.5) * (k - 1))])} r="4.5" />
    {#if hover !== null}<line class="cross" x1={g.sx(offsetOf(hover))} y1={g.Y0} x2={g.sx(offsetOf(hover))} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(offsetOf(hover))}
        y={g.sy(curve[hover])}
        {width}
        text="{nf(offsetOf(hover), 3)} bin · {nf(curve[hover], 2)} ENOB, rectangular {nf(reference[hover], 2)}"
      />
    {/if}
  {/snippet}
</Plot>

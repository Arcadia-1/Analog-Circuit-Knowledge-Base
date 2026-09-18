<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Split } from './model';

  /**
   * analyze_error_by_phase: the rms of the residual in each phase bin, and over it the shape ADCToolbox fitted —
   * am² cos²φ for the part that rides on the signal, pm² sin²φ for the part that rides on its slope, and a constant.
   */
  let { split, hover, onhover, label }: {
    split: Split;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46;
  const k = $derived(split.centers.length);
  /** the fitted shape, in volts rms */
  const model = (phi: number): number =>
    Math.sqrt(split.am ** 2 * Math.cos(phi) ** 2 + split.pm ** 2 * Math.sin(phi) ** 2 + split.base ** 2);

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const seen = Array.from(split.rms).filter(Number.isFinite);
    const top = Math.max(...seen, model(0), model(Math.PI / 2)) * 1.25e6;
    const sx = (phi: number) => X0 + (phi / (2 * Math.PI)) * (X1 - X0);
    const sy = (uv: number) => Y0 + ((top - clamp(uv, 0, top)) / top) * (Y1 - Y0);
    let bars = '';
    for (let b = 0; b < k; b++) if (Number.isFinite(split.rms[b])) bars += `M${sx(split.centers[b]).toFixed(1)},${Y1}V${sy(split.rms[b] * 1e6).toFixed(1)}`;
    const fit = Array.from({ length: 121 }, (_, i) => {
      const phi = (i / 120) * 2 * Math.PI;
      return `${i ? 'L' : 'M'}${sx(phi).toFixed(1)},${sy(model(phi) * 1e6).toFixed(1)}`;
    }).join('');
    const step = top > 400 ? 200 : top > 200 ? 100 : top > 80 ? 40 : top > 40 ? 20 : top > 16 ? 8 : top > 4 ? 2 : 1;
    const grid: number[] = [];
    for (let v = 0; v <= top; v += step) grid.push(v);
    return { X1, Y0, Y1, sx, sy, bars, fit, grid };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.round(((px - X0) / (W - 8 - X0)) * (k - 1)), 0, k - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each [{ at: 0, text: '0' }, { at: Math.PI / 2, text: 'π/2' }, { at: Math.PI, text: 'π' }, { at: 1.5 * Math.PI, text: '3π/2' }, { at: 2 * Math.PI, text: '2π' }] as t, i (i)}
      <text class="tx" x={g.sx(t.at)} y={height - 5} text-anchor={i === 0 ? 'start' : t.at === 2 * Math.PI ? 'end' : 'middle'}>{t.text}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>error rms, µV</text>
    <path class="bars" d={g.bars} />
    <path class="c2" stroke-width="2" d={g.fit} />
    {#if hover !== null}<line class="cross" x1={g.sx(split.centers[hover])} y1={g.Y0} x2={g.sx(split.centers[hover])} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && Number.isFinite(split.rms[hover])}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(split.centers[hover])}
        y={g.sy(split.rms[hover] * 1e6)}
        {width}
        text="φ {nf(split.centers[hover], 2)} · rms {nf(split.rms[hover] * 1e6, 2)} µV · fitted {nf(model(split.centers[hover]) * 1e6, 2)} µV · {split.counts[hover]} samples"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .bars { stroke: var(--s1); stroke-width: 2.4; opacity: 0.55; fill: none; }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Spectrum } from '../../lib/spectrum';
  import { FS, N } from './model';

  /**
   * The spectrum on a logarithmic frequency axis, where noise shaping is a straight line: the band the OSR keeps is
   * shaded, and the dashed line is white quantisation noise through |NTF|².
   */
  let { spectrum, theory, hover, onhover, label }: {
    spectrum: Spectrum;
    /** dBFS per bin the NTF predicts */
    theory: (bin: number) => number;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46, HALF = N / 2, BOTTOM = -200;
  const DECADES = [1e5, 1e6, 1e7];

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const span = Math.log10(HALF);
    const sx = (bin: number) => X0 + (Math.log10(Math.max(bin, 1)) / span) * (X1 - X0);
    const sy = (v: number) => Y0 + (clamp(v, BOTTOM, 0) / BOTTOM) * (Y1 - Y0);
    let d = '';
    for (let k = 1; k <= HALF; k++) d += `${k > 1 ? 'L' : 'M'}${sx(k).toFixed(1)},${sy(spectrum.dbfs[k]).toFixed(1)}`;
    let ideal = '';
    for (let i = 0; i <= 160; i++) {
      const k = HALF ** (i / 160);
      ideal += `${i ? 'L' : 'M'}${sx(k).toFixed(1)},${sy(theory(k)).toFixed(1)}`;
    }
    const edge = sx(spectrum.inband - 1);
    const grid: number[] = [];
    for (let v = BOTTOM; v <= 0; v += 40) grid.push(v);
    return { X1, Y0, Y1, sx, sy, d, ideal, edge, grid };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    onhover(px >= X0 && px <= X1 ? clamp(Math.round(HALF ** ((px - X0) / (X1 - X0))), 1, HALF) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <rect class="a1" x={X0} y={g.Y0} width={Math.max(0, g.edge - X0)} height={g.Y1 - g.Y0} />
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>
    {/each}
    {#each DECADES as f (f)}
      <line class="gr" x1={g.sx((f * N) / FS)} y1={g.Y0} x2={g.sx((f * N) / FS)} y2={g.Y1} />
      {#if g.sx((f * N) / FS) < g.X1 - 60}<text class="tx" x={g.sx((f * N) / FS)} y={height - 5} text-anchor="middle">{freqText(f)}</text>{/if}
    {/each}
    <text class="tx" x={g.X1} y={height - 5} text-anchor="end">50 MHz</text>
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>dBFS</text>
    <text class="tx2 halo" x={g.edge - 6} y={g.Y1 - 8} text-anchor="end">signal band</text>
    <path class="c1" stroke-width="1" d={g.d} />
    <path class="ideal" d={g.ideal} />
    <circle class="f1 ring" cx={g.sx(spectrum.signal)} cy={g.sy(spectrum.dbfs[spectrum.signal])} r="4.5" />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(spectrum.dbfs[hover])}
        {width}
        text="{freqText((hover * FS) / N)} · {nf(spectrum.dbfs[hover], 1)} dBFS{hover === spectrum.signal ? ' · the tone' : hover < spectrum.inband ? ' · in band' : ''}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { fill: none; stroke: var(--ink-2); stroke-width: 1.2; stroke-dasharray: 5 4; }
</style>

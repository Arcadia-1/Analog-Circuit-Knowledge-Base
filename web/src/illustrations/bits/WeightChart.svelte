<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Radix } from './model';

  /**
   * analyze_weight_radix on the calibrated weights, on a log scale, with the ratio of each weight to the one before it.
   * The rings are the capacitors, scaled to the same total; a ratio that strays from theirs is orange.
   */
  let { weights, nominal, radix, nominalRadix, hover, onhover, label }: {
    weights: Float64Array;
    nominal: number[];
    radix: Radix;
    nominalRadix: Radix;
    hover: number | null;
    onhover: (bit: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 24, Y1 = H - 20, m = weights.length;
    const abs = Array.from(weights, Math.abs);
    const total = abs.reduce((a, b) => a + b, 0), scale = total / nominal.reduce((a, b) => a + b, 0);
    const rings = nominal.map((c) => c * scale);
    const positive = [...abs, ...rings].filter((v) => v > 0);
    const top = Math.ceil(Math.log10(Math.max(...positive))), bottom = Math.floor(Math.log10(Math.min(...positive)));
    const sy = (v: number) => Y0 + ((top - Math.log10(Math.max(v, 10 ** bottom))) / Math.max(1, top - bottom)) * (Y1 - Y0);
    const step = (X1 - X0) / m;
    const sx = (j: number) => X0 + (j + 0.5) * step;
    const line = abs.map((v, j) => `${j ? 'L' : 'M'}${sx(j).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const decades = Array.from({ length: top - bottom + 1 }, (_, i) => bottom + i);
    return { X1, Y0, Y1, sy, sx, step, abs, rings, line, decades };
  }

  function move(px: number, W: number) {
    const m = weights.length, step = (W - 8 - X0) / m;
    onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor((px - X0) / step), 0, m - 1) : null);
  }

  const strays = (j: number) => Math.abs(radix.radix[j - 1] / nominalRadix.radix[j - 1] - 1) > 0.05;
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.decades as d (d)}
      <line class="gr" x1={X0} y1={g.sy(10 ** d)} x2={g.X1} y2={g.sy(10 ** d)} />
      <text class="tx" x={X0 - 6} y={g.sy(10 ** d)} text-anchor="end" dominant-baseline="central">1e{d}</text>
    {/each}
    <path class="c1" stroke-width="1.6" d={g.line} />
    {#each g.abs as v, j (j)}
      <circle class="set" cx={g.sx(j)} cy={g.sy(g.rings[j])} r="6" />
      <circle class={hover === j ? 'f1 ring' : 'f1'} cx={g.sx(j)} cy={g.sy(v)} r={hover === j ? 4.5 : 3.2} />
      {#if j && g.step > 26}
        <text class="ratio" class:off={strays(j)} x={g.sx(j)} y={Math.min(g.sy(v), g.sy(g.rings[j])) - 10} text-anchor="middle">{nf(radix.radix[j - 1], 2)}</text>
      {/if}
      <text class="tx" x={g.sx(j)} y={height - 5} text-anchor="middle">{j + 1}</text>
    {/each}
    <text class="tx2 halo" x={g.X1} y={12} text-anchor="end">ratio to the bit before</text>
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(g.abs[hover])}
        {width}
        text="bit {hover + 1} · weight {nf(weights[hover], 6)}{hover ? ` · ${nf(radix.radix[hover - 1], 3)} below bit ${hover} (capacitors: ${nf(nominalRadix.radix[hover - 1], 3)})` : ''}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .set { fill: none; stroke: var(--ink-3); stroke-width: 1.2; }
  .ratio { fill: var(--ink-2); font: 10.5px var(--mono); font-variant-numeric: tabular-nums; }
  .ratio.off { fill: var(--s2); font-weight: 600; }
</style>

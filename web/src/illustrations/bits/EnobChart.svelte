<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /**
   * analyze_enob_sweep: ENOB from the first one, two, … bits of one full calibration, with what each bit added; dashed,
   * the ENOB of all the bits with the capacitors as weights.
   */
  let { sweep, uncalibrated, stale, hover, onhover, label }: {
    sweep: number[];
    uncalibrated: number;
    stale: boolean;
    hover: number | null;
    onhover: (count: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, m = sweep.length;
    const top = Math.ceil(Math.max(...sweep, uncalibrated) + 1.5);
    const sy = (v: number) => Y0 + ((top - clamp(v, 0, top)) / top) * (Y1 - Y0);
    const step = (X1 - X0) / m;
    const sx = (j: number) => X0 + (j + 0.5) * step;
    const line = sweep.map((v, j) => `${j ? 'L' : 'M'}${sx(j).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const ticks = Array.from({ length: Math.floor(top / 2) + 1 }, (_, i) => 2 * i);
    return { X1, Y0, Y1, sy, sx, step, line, ticks };
  }

  function move(px: number, W: number) {
    const m = sweep.length, step = (W - 8 - X0) / m;
    onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor((px - X0) / step), 0, m - 1) : null);
  }

  const gain = (j: number) => (j ? sweep[j] - sweep[j - 1] : sweep[0]);
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    <line class="ideal" x1={X0} y1={g.sy(uncalibrated)} x2={g.X1} y2={g.sy(uncalibrated)} />
    <g class:stale>
      <path class="c1" stroke-width="1.8" d={g.line} />
      {#each sweep as v, j (j)}
        <circle class={hover === j ? 'f1 ring' : 'f1'} cx={g.sx(j)} cy={g.sy(v)} r={hover === j ? 4.5 : 3.2} />
        {#if g.step > 26}
          <text class="gain" class:low={j > 0 && gain(j) < 0.5} x={g.sx(j)} y={g.sy(v) - 9} text-anchor="middle">{j ? `+${nf(gain(j), 2)}` : nf(v, 2)}</text>
        {/if}
      {/each}
    </g>
    {#each sweep as _, j (j)}
      <text class="tx" x={g.sx(j)} y={height - 5} text-anchor="middle">{j + 1}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>ENOB, bits</text>
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(sweep[hover])} {width} text="bits 1 … {hover + 1} · ENOB {nf(sweep[hover], 2)}{hover ? `, ${gain(hover) < 0 ? '' : '+'}${nf(gain(hover), 2)} from bit ${hover + 1}` : ''}" />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { stroke: var(--ink-2); stroke-width: 1.2; stroke-dasharray: 5 4; }
  .gain { fill: var(--ink-2); font: 10.5px var(--mono); font-variant-numeric: tabular-nums; }
  .gain.low { fill: var(--s2); font-weight: 600; }
  .stale { opacity: 0.35; }
</style>

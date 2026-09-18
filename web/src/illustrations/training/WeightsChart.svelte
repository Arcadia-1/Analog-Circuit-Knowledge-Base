<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp, niceSpan } from '../../lib/scale';

  /**
   * Each capacitor as a share of the size it was drawn at: the bar is how the chip came out of the factory, the dot is
   * what the calibration decided it was. Where the two agree the calibration has learnt the array; where they do not,
   * it has learnt the training capture instead.
   */
  let { built, recovered, hover, onhover, label }: {
    built: number[];
    recovered: number[];
    hover: number | null;
    onhover: (j: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44;
  const span = $derived(niceSpan(Math.max(...built.map((v) => Math.abs(v - 1)), ...recovered.map((v) => Math.abs(v - 1))) * 100));

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 10, Y1 = H - 18, m = built.length;
    const step = (X1 - X0) / m;
    const sx = (j: number) => X0 + (j + 0.5) * step;
    const sy = (pct: number) => (Y0 + Y1) / 2 - (clamp(pct, -span, span) / span) * ((Y1 - Y0) / 2);
    const grid = [-1, -0.5, 0, 0.5, 1].map((f) => f * span);
    return { X1, Y0, Y1, sx, sy, step, grid, zero: sy(0) };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => {
    const m = built.length, step = (W - 8 - X0) / m;
    onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor((px - X0) / step), 0, m - 1) : null);
  }}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" class:zero={Math.abs(v) < 1e-12} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, span < 1 ? 2 : 1)}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>% off the drawn size</text>
    {#each built as v, j (j)}
      <rect class="f1 bar" x={g.sx(j) - Math.min(7, g.step * 0.3)} y={Math.min(g.zero, g.sy((v - 1) * 100))} width={2 * Math.min(7, g.step * 0.3)} height={Math.max(1, Math.abs(g.sy((v - 1) * 100) - g.zero))} />
    {/each}
    {#each recovered as v, j (j)}
      <circle class="f2" cx={g.sx(j)} cy={g.sy((v - 1) * 100)} r={hover === j ? 4.5 : 3} />
    {/each}
    {#each built as _, j (j)}
      {#if g.step > 20 || j % 2 === 0}
        <text class="tx" x={g.sx(j)} y={height - 4} text-anchor="middle">{j + 1}</text>
      {/if}
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy((built[hover] - 1) * 100)}
        {width}
        text="weight {hover + 1} · built {nf((built[hover] - 1) * 100, 3)} % off · calibration says {nf((recovered[hover] - 1) * 100, 3)} %"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .bar { opacity: 0.75; }
  .zero { stroke: var(--rule); }
</style>

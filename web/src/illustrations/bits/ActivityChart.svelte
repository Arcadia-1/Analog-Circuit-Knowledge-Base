<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /** analyze_bit_activity: the share of samples in which each bit is 1, against the 50 % a full-scale sine gives. */
  let { activity, hover, onhover, label }: {
    activity: number[];
    hover: number | null;
    onhover: (bit: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, m = activity.length;
    const spread = Math.max(10, ...activity.map((v) => Math.ceil(Math.abs(v - 50) / 5) * 5));
    const sy = (v: number) => Y0 + ((50 + spread - clamp(v, 50 - spread, 50 + spread)) / (2 * spread)) * (Y1 - Y0);
    const step = (X1 - X0) / m;
    const sx = (j: number) => X0 + (j + 0.5) * step;
    const worst = activity.reduce((b, v, j) => (Math.abs(v - 50) > Math.abs(activity[b] - 50) ? j : b), 0);
    return { X1, Y0, Y1, sy, sx, step, worst, ticks: [50 - spread, 50 - spread / 2, 50, 50 + spread / 2, 50 + spread] };
  }

  function move(px: number, W: number) {
    const m = activity.length, step = (W - 8 - X0) / m;
    onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor((px - X0) / step), 0, m - 1) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as v (v)}
      <line class={v === 50 ? 'mid' : 'gr'} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each activity as v, j (j)}
      {@const x = g.sx(j) - Math.min(g.step * 0.32, 14)}
      <rect class={j === g.worst ? 'f2' : 'f1'} {x} y={Math.min(g.sy(v), g.sy(50))} width={Math.min(g.step * 0.64, 28)} height={Math.max(1, Math.abs(g.sy(v) - g.sy(50)))} opacity={hover === null || hover === j ? 1 : 0.45} />
      <text class="tx" x={g.sx(j)} y={height - 5} text-anchor="middle">{j + 1}</text>
    {/each}
    <text class="tx2 tx-ink halo" x={g.sx(g.worst)} y={activity[g.worst] >= 50 ? g.sy(activity[g.worst]) - 6 : g.sy(activity[g.worst]) + 14} text-anchor="middle">{activity[g.worst] >= 50 ? '+' : ''}{nf(activity[g.worst] - 50, 2)}</text>
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>% of samples with the bit at 1</text>
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(Math.max(activity[hover], 50))} {width} text="bit {hover + 1} · 1 in {nf(activity[hover], 2)} % of samples" />
    {/if}
  {/snippet}
</Plot>

<style>
  .mid { stroke: var(--ink-2); stroke-width: 1.2; stroke-dasharray: 5 4; }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import type { Spread } from './model';

  let { values, spread, hover, onhover, label }: {
    values: number[];
    spread: Spread | null;
    hover: number | null;
    onhover: (index: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44;
  function geo(W: number, H: number) {
    const X1 = W - 10, Y0 = 8, Y1 = H - 20;
    const low = values.length ? Math.min(...values) : 0, high = values.length ? Math.max(...values) : 1;
    const pad = Math.max(0.08, (high - low) * 0.18), lo = low - pad, hi = high + pad;
    const sx = (i: number) => X0 + (i / Math.max(1, values.length - 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - v) / Math.max(hi - lo, 0.1)) * (Y1 - Y0);
    const trace = values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const ticks = Array.from({ length: 4 }, (_, i) => lo + (i / 3) * (hi - lo));
    return { X1, Y0, Y1, sx, sy, trace, ticks };
  }

  function move(px: number, W: number) {
    if (!values.length) return onhover(null);
    const g = geo(W, 100);
    if (px < X0 - 6 || px > g.X1 + 6) return onhover(null);
    onhover(Math.max(0, Math.min(values.length - 1, Math.round(((px - X0) / (g.X1 - X0)) * (values.length - 1)))));
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as tick}
      <line class="gr" x1={X0} x2={g.X1} y1={g.sy(tick)} y2={g.sy(tick)} />
      <text class="tx" x={X0 - 7} y={g.sy(tick)} text-anchor="end" dominant-baseline="central">{nf(tick, 1)}</text>
    {/each}
    {#if spread}
      <rect class="band" x={X0} width={g.X1 - X0} y={g.sy(spread.mean + spread.sigma)} height={Math.max(1, g.sy(spread.mean - spread.sigma) - g.sy(spread.mean + spread.sigma))} />
      <line class="c1 dash" x1={X0} x2={g.X1} y1={g.sy(spread.mean)} y2={g.sy(spread.mean)} />
    {/if}
    {#if values.length > 1}<path class="c2" stroke-width="1.5" d={g.trace} />{/if}
    {#each values as value, i}
      <circle class="f2" cx={g.sx(i)} cy={g.sy(value)} r={hover === i ? 4.5 : 2.8} />
    {/each}
    <text class="tx" x={X0} y={height - 5}>run 1</text>
    <text class="tx" x={g.X1} y={height - 5} text-anchor="end">run {values.length}</text>
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 11}>SNDR, dB</text>
    {#if hover !== null && values[hover] != null}<line class="cross" x1={g.sx(hover)} x2={g.sx(hover)} y1={g.Y0} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && values[hover] != null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(values[hover])} {width} text="run {hover + 1} · SNDR {nf(values[hover], 2)} dB" />
    {/if}
  {/snippet}
</Plot>

<style>
  .band { fill: var(--s1-soft); }
  .dash { stroke-dasharray: 5 4; }
</style>

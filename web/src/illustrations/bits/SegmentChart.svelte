<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Overflow } from './model';

  /**
   * analyze_overflow: for every bit, what the code from that bit down reads as a share of its weights, one column of
   * density per bit, with the range it covered and how often it sat on 0 or on 1.
   */
  let { overflow, hover, onhover, label }: {
    overflow: Overflow;
    hover: number | null;
    onhover: (bit: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40, LEVELS = 48;

  // the share each segment read, binned into LEVELS steps of 0 … 1
  const density = $derived(
    overflow.share.map((share) => {
      const count = new Array<number>(LEVELS).fill(0);
      for (const v of share) count[clamp(Math.floor(v * LEVELS), 0, LEVELS - 1)]++;
      const most = Math.max(...count);
      return count.map((c) => (c ? 0.15 + 0.85 * Math.sqrt(c / most) : 0));
    }),
  );

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 22, Y1 = H - 36, m = overflow.share.length;
    const sy = (v: number) => Y1 - v * (Y1 - Y0);
    const step = (X1 - X0) / m;
    const sx = (j: number) => X0 + (j + 0.5) * step;
    const envelope = (a: number[]) => a.map((v, j) => `${j ? 'L' : 'M'}${sx(j).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    return { X1, Y0, Y1, sy, sx, step, lo: envelope(overflow.lo), hi: envelope(overflow.hi), cell: (Y1 - Y0) / LEVELS };
  }

  function move(px: number, W: number) {
    const m = overflow.share.length, step = (W - 8 - X0) / m;
    onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor((px - X0) / step), 0, m - 1) : null);
  }

  // a narrow column has room for two digits
  const pct = (v: number, step: number) => (v >= 10 || step < 32 ? nf(v, 0) : v >= 1 ? nf(v, 1) : nf(v, 2));
  const shown = (v: number, step: number) => (step < 32 ? v >= 0.5 : v > 0);
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, 0.5, 1] as v (v)}
      <line class={v === 0.5 ? 'gr' : 'zero'} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each density as col, j (j)}
      {@const w = Math.min(g.step * 0.5, 22)}
      {#each col as a, k (k)}
        {#if a}<rect class="f1" x={g.sx(j) - w / 2} y={g.sy((k + 1) / LEVELS)} width={w} height={g.cell + 0.4} opacity={a} />{/if}
      {/each}
      {#if shown(overflow.atOne[j], g.step)}<text class="rail" class:hot={j === hover} x={g.sx(j)} y={g.Y0 - 7} text-anchor="middle">{pct(overflow.atOne[j], g.step)}</text>{/if}
      {#if shown(overflow.atZero[j], g.step)}<text class="rail" class:hot={j === hover} x={g.sx(j)} y={g.Y1 + 13} text-anchor="middle">{pct(overflow.atZero[j], g.step)}</text>{/if}
      <text class="tx" x={g.sx(j)} y={height - 5} text-anchor="middle">{j + 1}</text>
    {/each}
    <path class="c2" stroke-width="1.6" d={g.lo} />
    <path class="c2" stroke-width="1.6" d={g.hi} />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(overflow.hi[hover])}
        {width}
        text="bits {hover + 1} … {overflow.share.length} read {nf(overflow.lo[hover], 3)} … {nf(overflow.hi[hover], 3)} of their weight · at 0 in {nf(overflow.atZero[hover], 2)} %, at 1 in {nf(overflow.atOne[hover], 2)} % of samples"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .rail { fill: var(--s2); font: 10.5px var(--mono); font-variant-numeric: tabular-nums; }
  .rail.hot { font-weight: 600; }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { enobToSnr } from '../../lib/units';
  import type { ShortRow } from './model';

  /**
   * exp_s09: the same converter with the tone as close to Nyquist as each record allows. Even and odd lengths are
   * drawn apart, because which one you pick changes the answer more than the length itself does.
   */
  let { rows, bits, hover, onhover, label }: {
    rows: ShortRow[];
    bits: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 36;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const values = rows.flatMap((r) => [r.sndr, r.sfdr]);
    const lo = 5 * Math.floor(Math.min(...values, enobToSnr(bits)) / 5 - 0.2);
    const hi = 5 * Math.ceil(Math.max(...values, enobToSnr(bits)) / 5 + 0.2);
    const sx = (i: number) => X0 + (i / (rows.length - 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (Y1 - Y0);
    const line = (pick: (r: ShortRow) => number, odd: boolean) =>
      rows.map((r, i) => (r.n % 2 === (odd ? 1 : 0) ? `${sx(i).toFixed(1)},${sy(pick(r)).toFixed(1)}` : null))
        .filter(Boolean)
        .map((p, i) => `${i ? 'L' : 'M'}${p}`)
        .join('');
    const grid: number[] = [];
    for (let v = lo; v <= hi; v += 5) grid.push(v);
    return {
      X1, Y0, Y1, sx, sy, grid,
      sfdrEven: line((r) => r.sfdr, false),
      sfdrOdd: line((r) => r.sfdr, true),
      sndr: line((r) => r.sndr, false) + line((r) => r.sndr, true),
    };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 - 6 && px <= W - 8 ? clamp(Math.round(((px - X0) / (W - 8 - X0)) * (rows.length - 1)), 0, rows.length - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    <line class="ideal" x1={X0} y1={g.sy(enobToSnr(bits))} x2={g.X1} y2={g.sy(enobToSnr(bits))} />
    <text class="tx halo" x={g.X1 - 4} y={g.sy(enobToSnr(bits)) - 6} text-anchor="end">{bits} bits, ideally</text>
    {#each rows as r, i (r.n)}
      {#if i % 2 === 0}
        <text class="tx" x={g.sx(i) + 6} y={height - 5} text-anchor="middle">{r.n}</text>
      {/if}
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 24}>dBc</text>
    <path class="c1" stroke-width="1.8" d={g.sfdrEven} />
    <path class="c1 odd" stroke-width="1.8" d={g.sfdrOdd} />
    <path class="c2" stroke-width="1.6" d={g.sndr} />
    {#each rows as r, i (r.n)}
      <circle class="f1" cx={g.sx(i)} cy={g.sy(r.sfdr)} r={hover === i ? 4.5 : 2.6} />
      <circle class="f2" cx={g.sx(i)} cy={g.sy(r.sndr)} r={hover === i ? 4.5 : 2.6} />
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && rows[hover]}
      {@const g = geo(width, height)}
      {@const r = rows[hover]}
      <Tip x={g.sx(hover)} y={g.sy(r.sfdr)} {width} text="{r.n} points{r.n % 2 ? ', odd' : ''} · bin {r.bin} · SFDR {nf(r.sfdr, 1)} · SNDR {nf(r.sndr, 1)} dBc · ENOB {nf(r.enob, 2)}" />
    {/if}
  {/snippet}
</Plot>

<style>
  .odd { stroke-dasharray: 6 4; }
  .ideal { stroke: var(--ink-3); stroke-width: 1.2; stroke-dasharray: 3 3; }
</style>

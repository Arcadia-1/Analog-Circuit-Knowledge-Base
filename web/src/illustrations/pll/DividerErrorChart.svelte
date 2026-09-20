<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  let { acc, mash, count = 64, hover, onhover, label }: {
    acc: Float64Array;
    mash: Float64Array;
    count?: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 42;
  const shown = $derived(Math.min(count, acc.length, mash.length));

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const all = [...Array.from(acc.subarray(0, shown)), ...Array.from(mash.subarray(0, shown)), 0];
    const lo = Math.floor((Math.min(...all) - 0.15) * 2) / 2;
    const hi = Math.ceil((Math.max(...all) + 0.15) * 2) / 2;
    const sx = (i: number) => X0 + (i / Math.max(shown - 1, 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - v) / Math.max(hi - lo, 0.5)) * (Y1 - Y0);
    const path = (a: Float64Array) => Array.from({ length: shown }, (_, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(a[i]).toFixed(1)}`).join('');
    const grid: number[] = [];
    for (let v = Math.ceil(lo); v <= Math.floor(hi); v++) grid.push(v);
    return { X1, Y0, Y1, sx, sy, accPath: path(acc), mashPath: path(mash), grid };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    onhover(px < X0 - 6 || px > X1 + 6 ? null : clamp(Math.round(((px - X0) / (X1 - X0)) * (shown - 1)), 0, shown - 1));
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 12}>Σ(y − α), output-clock periods</text>
    <path class="c1" stroke-width="2.1" d={g.accPath} />
    <path class="c2" stroke-width="2.1" d={g.mashPath} />
    {#each [0, 16, 32, 48, shown - 1] as i (i)}
      {#if i < shown}<text class="tx" x={g.sx(i)} y={height - 5} text-anchor={i === 0 ? 'start' : i === shown - 1 ? 'end' : 'middle'}>{i}</text>{/if}
    {/each}
    {#if hover !== null}
      <circle class="f1" cx={g.sx(hover)} cy={g.sy(acc[hover])} r="4" />
      <circle class="f2" cx={g.sx(hover)} cy={g.sy(mash[hover])} r="4" />
    {/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(mash[hover])} {width} text="cycle {hover} · accumulator {nf(acc[hover], 3)} · MASH {nf(mash[hover], 3)} periods" />
    {/if}
  {/snippet}
</Plot>

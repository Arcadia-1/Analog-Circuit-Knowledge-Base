<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { clamp } from '../../lib/scale';

  let { counts, hover, onhover, label }: {
    counts: Uint16Array;
    hover: number | null;
    onhover: (code: number | null) => void;
    label: string;
  } = $props();

  const X0 = 38;
  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, top = Math.max(1, ...counts);
    const sx = (code: number) => X0 + ((code + 0.5) / counts.length) * (X1 - X0);
    const sy = (v: number) => Y0 + ((top - v) / top) * (Y1 - Y0);
    return { X1, Y0, Y1, top, sx, sy, bar: Math.max(1, (X1 - X0) / counts.length) };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor(((px - X0) / (W - 8 - X0)) * counts.length), 0, counts.length - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, g.top] as v}
      <line class="gr" x1={X0} x2={g.X1} y1={g.sy(v)} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each counts as count, code}
      {#if count > 0}<rect class="bar" class:active={hover === code} x={g.sx(code) - g.bar * .42} y={g.sy(count)} width={Math.max(1, g.bar * .84)} height={g.Y1 - g.sy(count)} />{/if}
    {/each}
    <text class="tx" x={X0} y={height - 5}>code 0</text>
    <text class="tx" x={g.X1} y={height - 5} text-anchor="end">code {counts.length - 1}</text>
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 11}>visits</text>
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} x2={g.sx(hover)} y1={g.Y0} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(counts[hover])} {width} text="code {hover} · {counts[hover]} visit{counts[hover] === 1 ? '' : 's'}" />
    {/if}
  {/snippet}
</Plot>

<style>
  .bar { fill: var(--s1); opacity: .72; }
  .bar.active { fill: var(--s2); opacity: 1; }
</style>

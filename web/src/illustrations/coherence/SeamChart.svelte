<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { idealCode } from './model';

  let { data, n, cycles, hover, onhover, label }: {
    data: Float64Array;
    n: number;
    cycles: number;
    hover: number | null;
    onhover: (index: number | null) => void;
    label: string;
  } = $props();

  const X0 = 42, HALF = 28;
  const offsets = Array.from({ length: 2 * HALF + 1 }, (_, i) => i - HALF);

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, full = 2 ** n;
    const sx = (offset: number) => X0 + ((offset + HALF) / (2 * HALF)) * (X1 - X0);
    const sy = (code: number) => Y0 + ((full - clamp(code, 0, full)) / full) * (Y1 - Y0);
    const repeated = offsets.map((offset, i) => {
      const at = offset < 0 ? data.length + offset : offset;
      return `${i ? 'L' : 'M'}${sx(offset).toFixed(1)},${sy(data[at]).toFixed(1)}`;
    }).join('');
    const continuous = offsets.map((offset, i) => `${i ? 'L' : 'M'}${sx(offset).toFixed(1)},${sy(idealCode(n, data.length, cycles, data.length + offset)).toFixed(1)}`).join('');
    return { X1, Y0, Y1, full, sx, sy, repeated, continuous };
  }

  const sampleAt = (offset: number) => data[offset < 0 ? data.length + offset : offset];
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.round(((px - X0) / (W - 8 - X0)) * 2 * HALF), 0, 2 * HALF) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, g.full / 2, g.full] as code}
      <line class="gr" x1={X0} x2={g.X1} y1={g.sy(code)} y2={g.sy(code)} />
      <text class="tx" x={X0 - 6} y={g.sy(code)} text-anchor="end" dominant-baseline="central">{code === g.full ? 'FS' : code}</text>
    {/each}
    <path class="continuous" d={g.continuous} />
    <path class="c1" stroke-width="2" d={g.repeated} />
    <line class="seam" x1={g.sx(0)} x2={g.sx(0)} y1={g.Y0} y2={g.Y1} />
    <text class="tx2 halo" x={g.sx(0) + 6} y={g.Y0 + 11}>record boundary</text>
    {#each [-HALF, -14, 0, 14, HALF] as offset, i}
      <text class="tx" x={g.sx(offset)} y={height - 5} text-anchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{offset === 0 ? 'repeat' : offset}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(offsets[hover])} x2={g.sx(offsets[hover])} y1={g.Y0} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const offset = offsets[hover]}
      <Tip x={g.sx(offset)} y={g.sy(sampleAt(offset))} {width} text="{offset < 0 ? `end ${offset}` : `repeated start +${offset}`} · code {nf(sampleAt(offset), 0)}" />
    {/if}
  {/snippet}
</Plot>

<style>
  .continuous { fill: none; stroke: var(--ink-3); stroke-width: 1.2; stroke-dasharray: 5 4; }
  .seam { stroke: var(--s2); stroke-width: 1.2; stroke-dasharray: 3 3; }
</style>

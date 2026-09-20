<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { clamp } from '../../lib/scale';

  let { acc, mash, count = 64, hover, onhover, label }: {
    acc: Int8Array;
    mash: Int8Array;
    count?: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 42;
  const shown = $derived(Math.min(count, acc.length, mash.length));

  function geo(W: number, H: number) {
    const X1 = W - 8;
    const sx = (i: number) => X0 + (i / Math.max(shown - 1, 1)) * (X1 - X0);
    const accZero = H * 0.40, mashZero = H * 0.76;
    const accScale = Math.min(28, H * 0.15);
    const maxMash = Math.max(1, ...Array.from(mash.subarray(0, shown), Math.abs));
    const mashScale = Math.min(12, (H * 0.18) / maxMash);
    return { X1, sx, accZero, mashZero, accScale, mashScale };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    onhover(px < X0 - 6 || px > X1 + 6 ? null : clamp(Math.round(((px - X0) / (X1 - X0)) * (shown - 1)), 0, shown - 1));
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <line class="gr" x1={X0} y1={g.accZero} x2={g.X1} y2={g.accZero} />
    <line class="gr" x1={X0} y1={g.mashZero} x2={g.X1} y2={g.mashZero} />
    <text class="tx2 halo" x={X0 + 5} y="15">first-order accumulator · y[k] = 0 or 1</text>
    <text class="tx2 halo" x={X0 + 5} y={height * 0.52}>MASH 1-1-1 · multibit y[k]</text>
    {#each Array.from({ length: shown }) as _, i (i)}
      <line class="c1" stroke-width={hover === i ? 3 : 1.7} x1={g.sx(i)} y1={g.accZero} x2={g.sx(i)} y2={g.accZero - acc[i] * g.accScale} />
      <circle class="f1" cx={g.sx(i)} cy={g.accZero - acc[i] * g.accScale} r={hover === i ? 3.7 : 2.1} />
      <line class="c2" stroke-width={hover === i ? 3 : 1.7} x1={g.sx(i)} y1={g.mashZero} x2={g.sx(i)} y2={g.mashZero - mash[i] * g.mashScale} />
      <circle class="f2" cx={g.sx(i)} cy={g.mashZero - mash[i] * g.mashScale} r={hover === i ? 3.7 : 2.1} />
    {/each}
    {#each [0, 16, 32, 48, shown - 1] as i (i)}
      {#if i < shown}<text class="tx" x={g.sx(i)} y={height - 5} text-anchor={i === 0 ? 'start' : i === shown - 1 ? 'end' : 'middle'}>{i}</text>{/if}
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.accZero - acc[hover] * g.accScale} {width} text="cycle {hover} · accumulator {acc[hover]} · MASH {mash[hover]}" />
    {/if}
  {/snippet}
</Plot>

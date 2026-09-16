<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { FS, residual } from './model';

  /**
   * The first kept samples over the input they were taken from and the one slow sine that passes through all of them.
   * The kept samples are taken at t = (keep − 1 + k·keep) / FS; at those instants the input and a sine at the signed
   * residual frequency agree exactly, which is all a record can say.
   */
  let { fin, fsOut, keep, samples, count, hover, onhover, label }: {
    fin: number;
    fsOut: number;
    keep: number;
    /** the kept samples around mid-scale, as a fraction of the amplitude */
    samples: Float64Array;
    count: number;
    hover: number | null;
    onhover: (k: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44, BUSY = 150;
  const t0 = $derived((keep - 1) / FS);
  const ticks = $derived([...Array.from({ length: Math.ceil((count - 1) / 8) }, (_, i) => i * 8), count - 1]);
  const cycles = $derived((fin * (count - 1)) / fsOut);

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const sx = (k: number) => X0 + ((k + 0.5) / count) * (X1 - X0);
    const sy = (v: number) => Y0 + ((1.15 - clamp(v, -1.15, 1.15)) / 2.3) * (Y1 - Y0);
    // k is time in kept-sample periods from the first kept sample
    const line = (fn: (k: number) => number, points: number) =>
      Array.from({ length: points + 1 }, (_, i) => {
        const k = ((count - 1) * i) / points;
        return `${i ? 'L' : 'M'}${sx(k).toFixed(2)},${sy(fn(k)).toFixed(2)}`;
      }).join('');
    const input = cycles > BUSY ? '' : line((k) => Math.sin(2 * Math.PI * fin * (t0 + k / fsOut)), Math.ceil(cycles * 24) + 2);
    const r = residual(fin, fsOut);
    const alias = line((k) => Math.sin(2 * Math.PI * fin * t0 + (2 * Math.PI * r * k) / fsOut), 400);
    return { X1, Y0, Y1, sx, sy, input, alias };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor(((px - X0) / (W - 8 - X0)) * count), 0, count - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [-1, 0, 1] as v (v)}
      <line class={v ? 'gr' : 'zero'} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>
    {/each}
    {#each ticks as k (k)}
      <text class="tx" x={g.sx(k)} y={height - 5} text-anchor={k === 0 ? 'start' : k === count - 1 ? 'end' : 'middle'}>{k === count - 1 ? `${k} kept` : k}</text>
    {/each}
    {#if g.input}
      <path class="input" d={g.input} />
    {:else}
      <rect class="blur" x={g.sx(0)} y={g.sy(1)} width={g.sx(count - 1) - g.sx(0)} height={g.sy(-1) - g.sy(1)} />
      <text class="tx2 halo" x={g.X1 - 6} y={g.Y1 - 8} text-anchor="end">the input makes {nf(fin / fsOut, 1)} cycles between kept samples</text>
    {/if}
    <path class="c1" stroke-width="2" d={g.alias} />
    {#each samples.subarray(0, count) as v, k (k)}
      <circle class="sample" cx={g.sx(k)} cy={g.sy(v)} r="3.2" />
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(samples[hover])}
        {width}
        text="kept sample {hover} · t = {nf((t0 + hover / fsOut) * 1e9, 0)} ns · {nf(samples[hover], 3)}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .input { fill: none; stroke: var(--ghost); stroke-width: 1; }
  .blur { fill: var(--ghost); opacity: 0.22; }
  .sample { fill: var(--ink); stroke: var(--plot); stroke-width: 1.5; }
</style>

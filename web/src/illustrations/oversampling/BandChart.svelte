<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /**
   * The first samples of the record in two lanes: above, the output in grey and what ifilter keeps of it in blue;
   * below, on its own scale, what ifilter took away.
   */
  let { data, inband, count, hover, onhover, label }: {
    data: Float64Array;
    inband: Float64Array;
    count: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 50;
  const removed = $derived(data.map((v, i) => v - inband[i]));

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, split = Y0 + (Y1 - Y0) * 0.6;
    let peak = 0.5, rest = 1e-6;
    for (let i = 0; i < count; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
      rest = Math.max(rest, Math.abs(removed[i]));
    }
    const top = Math.ceil(peak * 4) / 4;
    // the lower lane's full scale, a 1-2-5 step in millivolts
    const mv = [1, 2, 5].flatMap((m) => [0.01, 0.1, 1, 10, 100, 1000].map((d) => m * d)).sort((a, b) => a - b).find((s) => s >= rest * 1e3) ?? 1e4;
    const sx = (i: number) => X0 + (i / (count - 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((top - v) / (2 * top)) * (split - 10 - Y0);
    const sr = (v: number) => split + 6 + ((mv - clamp(v * 1e3, -mv, mv)) / (2 * mv)) * (Y1 - split - 6);
    const line = (a: Float64Array, y: (v: number) => number) => {
      let d = '';
      for (let i = 0; i < count; i++) d += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${y(a[i]).toFixed(1)}`;
      return d;
    };
    const ticks = top > 0.5 ? [-top, 0, top] : [-0.5, 0, 0.5];
    return { X1, Y0, Y1, split, sx, sy, sr, mv, ticks, raw: line(data, sy), band: line(inband, sy), cut: line(removed, sr) };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.round(((px - X0) / (W - 8 - X0)) * (count - 1)), 0, count - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as v (v)}
      <line class={v ? 'gr' : 'zero'} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 2)}</text>
    {/each}
    {#each [-g.mv, 0, g.mv] as v (v)}
      <line class={v ? 'gr' : 'zero'} x1={X0} y1={g.sr(v / 1e3)} x2={g.X1} y2={g.sr(v / 1e3)} />
      <text class="tx" x={X0 - 7} y={g.sr(v / 1e3)} text-anchor="end" dominant-baseline="central">{nf(v, v && Math.abs(v) < 1 ? 2 : 0)}</text>
    {/each}
    {#each [0, Math.round((count - 1) / 2), count - 1] as k, i (i)}
      <text class="tx" x={g.sx(k)} y={height - 5} text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{i === 2 ? `${k} samples` : k}</text>
    {/each}
    <path class="raw" d={g.raw} />
    <path class="c1" stroke-width="2" d={g.band} />
    <path class="c2" stroke-width="1" d={g.cut} />
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>output and its band, V</text>
    <text class="tx2 halo" x={X0 + 6} y={g.split + 16}>what ifilter took out, mV</text>
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.sx(hover)} y={g.sy(inband[hover])} {width} text="sample {hover} · output {nf(data[hover], 4)} V · band {nf(inband[hover], 4)} V · out of band {nf(removed[hover] * 1e3, 2)} mV" />
    {/if}
  {/snippet}
</Plot>

<style>
  .raw { fill: none; stroke: var(--ghost); stroke-width: 1; }
</style>

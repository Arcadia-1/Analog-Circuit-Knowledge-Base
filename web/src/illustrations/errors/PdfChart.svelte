<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Bins } from './model';

  /** How often the residual takes each value, against the Gaussian of the same rms. */
  let { bins, rms, hover, onhover, label }: {
    bins: Bins;
    rms: number;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 44;
  const k = $derived(bins.centers.length);
  const total = $derived(bins.counts.reduce((a, v) => a + v, 0));
  const width0 = $derived(bins.centers[1] - bins.centers[0]);
  const gauss = $derived((v: number) => (total * width0 * Math.exp((-v * v) / (2 * rms * rms))) / (rms * Math.sqrt(2 * Math.PI)));
  const top = $derived(1.12 * Math.max(...bins.counts, gauss(0)));

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 8, Y1 = H - 18;
    const lo = bins.centers[0] - width0 / 2, hi = bins.centers[k - 1] + width0 / 2;
    const sx = (v: number) => X0 + ((v - lo) / (hi - lo)) * (X1 - X0);
    const sy = (v: number) => Y1 - (clamp(v, 0, top) / top) * (Y1 - Y0);
    let bars = '';
    for (let b = 0; b < k; b++) {
      if (!bins.counts[b]) continue;
      const x0 = sx(bins.centers[b] - width0 / 2), x1 = sx(bins.centers[b] + width0 / 2);
      bars += `M${x0},${Y1}V${sy(bins.counts[b])}H${x1}V${Y1}Z`;
    }
    let curve = '';
    for (let px = 0; px <= X1 - X0; px += 2) {
      const v = lo + ((hi - lo) * px) / (X1 - X0);
      curve += `${px ? 'L' : 'M'}${X0 + px},${sy(gauss(v))}`;
    }
    const ticks = [lo, lo / 2, 0, hi / 2, hi].map((v) => Number(v.toFixed(1)));
    return { X1, Y0, Y1, sx, sy, bars, curve, ticks };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 6 ? clamp(Math.floor(((px - X0) / (W - 6 - X0)) * k), 0, k - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <line class="gr" x1={X0} y1={g.Y1} x2={g.X1} y2={g.Y1} />
    {#each g.ticks as v, i (i)}
      <text class="tx" x={g.sx(v)} y={height - 4} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{v}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>error, LSB</text>
    <path class="a1" d={g.bars} />
    <path class="guide" fill="none" d={g.curve} />
    {#if hover !== null}<line class="cross" x1={g.sx(bins.centers[hover])} y1={g.Y0} x2={g.sx(bins.centers[hover])} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(bins.centers[hover])}
        y={g.sy(bins.counts[hover])}
        {width}
        text="{nf(bins.centers[hover], 2)} LSB · {bins.counts[hover]} of {total} samples, {nf(gauss(bins.centers[hover]), 0)} if Gaussian"
      />
    {/if}
  {/snippet}
</Plot>

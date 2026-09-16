<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { FS, type Method, type Sweep } from './model';

  /**
   * SFDR against the input frequency for the same channels: raw and as predict_spurs expects it (orange), and after
   * each calibration (blue, the Farrow delay dashed). The chosen calibration is drawn heavier.
   */
  let { sweep, stale, at, nyquist, method, hover, onhover, label }: {
    sweep: Sweep;
    /** true while the controls have moved on and the sweep has not caught up */
    stale: boolean;
    /** the input the page is showing */
    at: number;
    nyquist: number;
    method: Method;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 40, TOP = FS / 2;

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20;
    const values = [...sweep.off, ...sweep.predicted, ...sweep.fft, ...sweep.farrow];
    const lo = 20 * Math.floor(Math.min(...values) / 20), hi = 20 * Math.ceil(Math.max(...values) / 20);
    const sx = (f: number) => X0 + (f / TOP) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (Y1 - Y0);
    const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${sx(sweep.fin[i]).toFixed(1)},${sy(v).toFixed(1)}`).join('');
    const grid: number[] = [];
    for (let v = lo; v <= hi; v += hi - lo > 80 ? 20 : 10) grid.push(v);
    const ticks = X1 - X0 < 360 ? [0, 250, 500] : [0, 100, 200, 300, 400, 500];
    return { ticks, X1, Y0, Y1, sx, sy, grid, off: line(sweep.off), predicted: line(sweep.predicted), fft: line(sweep.fft), farrow: line(sweep.farrow) };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    if (px < X0 - 4 || px > X1 + 4) return onhover(null);
    const f = ((px - X0) / (X1 - X0)) * TOP;
    let best = 0;
    sweep.fin.forEach((v, i) => {
      if (Math.abs(v - f) < Math.abs(sweep.fin[best] - f)) best = i;
    });
    onhover(best);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <rect class="a1" x={X0} y={g.Y0} width={g.sx(nyquist) - X0} height={g.Y1 - g.Y0} />
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each g.ticks as f, i (f)}
      <text class="tx" x={g.sx(f * 1e6)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{i === g.ticks.length - 1 ? `${f} MHz` : f}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>SFDR, dB</text>
    <line class="guide" x1={g.sx(at)} y1={g.Y0} x2={g.sx(at)} y2={g.Y1} />
    <g class:stale>
      <path class="c2 predicted" d={g.predicted} />
      <path class="c2" stroke-width="1.6" d={g.off} />
      <path class="c1" stroke-width={method === 'fft' ? 2.6 : 1.3} d={g.fft} />
      <path class="c1 dashed" stroke-width={method === 'farrow' ? 2.6 : 1.3} d={g.farrow} />
    </g>
    {#if hover !== null}<line class="cross" x1={g.sx(sweep.fin[hover])} y1={g.Y0} x2={g.sx(sweep.fin[hover])} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(sweep.fin[hover])}
        y={g.sy(Math.max(sweep.fft[hover], sweep.farrow[hover]))}
        {width}
        text="{freqText(sweep.fin[hover])} · raw {nf(sweep.off[hover], 1)} dB (predicted {nf(sweep.predicted[hover], 1)}) · FFT delay {nf(sweep.fft[hover], 1)} · Farrow {nf(sweep.farrow[hover], 1)}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .predicted { stroke-width: 1.2; stroke-dasharray: 2 3; }
  .dashed { stroke-dasharray: 6 4; }
  .stale { opacity: 0.35; }
</style>

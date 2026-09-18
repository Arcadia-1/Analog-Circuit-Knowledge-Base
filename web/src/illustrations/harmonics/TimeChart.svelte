<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp, niceSpan } from '../../lib/scale';
  import { DC, FS, type Decomposition } from './model';

  /**
   * analyze_decomposition_time: a few cycles of the capture with the fitted fundamental through it, and under that the
   * two parts the fit separated — the harmonics, which repeat with the signal, and the residual, which does not.
   */
  let { data, decomposition, fin, hover, onhover, label }: {
    data: Float64Array;
    decomposition: Decomposition;
    /** input frequency, to show how many cycles are on screen */
    fin: number;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 52, CYCLES = 2.5;
  const span = $derived(Math.max(4, Math.round((CYCLES * FS) / fin)));
  /** what the lower band is worth, in µV, rounded up to something readable */
  const scale = $derived.by(() => {
    let peak = 0;
    for (let i = 0; i < span; i++) peak = Math.max(peak, Math.abs(decomposition.harmonic[i]), Math.abs(decomposition.residual[i]));
    return Math.max(10, niceSpan(peak * 1e6));
  });

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 18, split = Y0 + (Y1 - Y0) * 0.56;
    const sx = (i: number) => X0 + (i / (span - 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((DC + 0.5 - clamp(v, DC - 0.5, DC + 0.5)) / 1) * (split - Y0);
    const lo = split + 12, hi = Y1;
    const sp = (uv: number) => (lo + hi) / 2 - (clamp(uv, -scale, scale) / scale) * ((hi - lo) / 2);
    const path = (f: (i: number) => number, to: (v: number) => number) =>
      Array.from({ length: span }, (_, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${to(f(i)).toFixed(1)}`).join('');
    return {
      X1, Y0, Y1, split, sx, sy, sp, lo, hi,
      signal: path((i) => data[i], sy),
      fundamental: path((i) => decomposition.fundamental[i], sy),
      harmonic: path((i) => decomposition.harmonic[i] * 1e6, sp),
      residual: path((i) => decomposition.residual[i] * 1e6, sp),
    };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    onhover(px >= X0 && px <= X1 ? clamp(Math.round(((px - X0) / (X1 - X0)) * (span - 1)), 0, span - 1) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [0, 0.5, 1] as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 1)}</text>
    {/each}
    {#each [-1, 0, 1] as s (s)}
      <line class="gr" class:zero={s === 0} x1={X0} y1={g.sp(s * scale)} x2={g.X1} y2={g.sp(s * scale)} />
      <text class="tx" x={X0 - 6} y={g.sp(s * scale)} text-anchor="end" dominant-baseline="central">{s * scale}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 12}>volts</text>
    <text class="tx2 halo" x={X0 + 6} y={g.lo + 12}>µV, what the fit took out</text>
    <path class="fund" d={g.fundamental} />
    <path class="c1" stroke-width="1.6" d={g.signal} />
    <path class="resid" d={g.residual} />
    <path class="c2" stroke-width="1.8" d={g.harmonic} />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(data[hover])}
        {width}
        text="sample {hover} · {nf(data[hover], 6)} V · harmonics {nf(decomposition.harmonic[hover] * 1e6, 1)} µV · residual {nf(decomposition.residual[hover] * 1e6, 1)} µV"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .fund { stroke: var(--ink-3); stroke-width: 2.4; fill: none; opacity: 0.6; }
  .resid { stroke: var(--ink-3); stroke-width: 1; fill: none; opacity: 0.75; }
  .zero { stroke: var(--rule); }
</style>

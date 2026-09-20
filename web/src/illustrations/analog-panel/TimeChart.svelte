<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { clamp } from '../../lib/scale';
  import type { Decomposition } from './model';

  let { signal, decomposition, bin, label }: { signal: Float64Array; decomposition: Decomposition; bin: number; label: string } = $props();

  const window = $derived.by(() => {
    const count = Math.max(24, Math.round((3 * signal.length) / bin));
    const start = Math.max(0, Math.floor(signal.length * 0.62));
    const end = Math.min(signal.length, start + count);
    let lo = Infinity, hi = -Infinity, er = 0;
    for (let i = start; i < end; i++) {
      lo = Math.min(lo, signal[i], decomposition.fundamental[i]);
      hi = Math.max(hi, signal[i], decomposition.fundamental[i]);
      er = Math.max(er, Math.abs(decomposition.harmonic[i]), Math.abs(decomposition.residual[i]));
    }
    return { start, end, lo, hi, er: Math.max(er, 1e-6) };
  });

  function geo(W: number, H: number) {
    const X0 = 40, X1 = W - 6, Y0 = 6, mid = H * 0.61, Y1 = H - 18;
    const sx = (i: number) => X0 + ((i - window.start) / Math.max(1, window.end - window.start - 1)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((window.hi - v) / (window.hi - window.lo)) * (mid - Y0 - 5);
    const se = (v: number) => mid + 8 + ((window.er - clamp(v, -window.er, window.er)) / (2 * window.er)) * (Y1 - mid - 8);
    const path = (values: Float64Array, scale: (v: number) => number) => {
      let d = '';
      for (let i = window.start; i < window.end; i++) d += `${d ? 'L' : 'M'}${sx(i).toFixed(1)},${scale(values[i]).toFixed(1)}`;
      return d;
    };
    return { X0, X1, Y0, mid, Y1, sy, se, signal: path(signal, sy), fitted: path(decomposition.fundamental, sy), harmonic: path(decomposition.harmonic, se), residual: path(decomposition.residual, se) };
  }
</script>

<Plot {label}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <line class="gr" x1={g.X0} y1={g.mid} x2={g.X1} y2={g.mid} />
    <line class="zero" x1={g.X0} y1={g.se(0)} x2={g.X1} y2={g.se(0)} />
    <text class="tx2 halo" x={g.X0 + 5} y={g.Y0 + 12}>signal + fitted sine</text>
    <text class="tx2 halo" x={g.X0 + 5} y={g.mid + 20}>harmonics + residual</text>
    <path class="guide" fill="none" stroke-width="1.3" d={g.signal} />
    <path class="c1" stroke-width="1.2" d={g.fitted} />
    <path class="c2" stroke-width="1.15" d={g.harmonic} />
    <path class="bad" stroke-width="0.9" d={g.residual} />
  {/snippet}
</Plot>

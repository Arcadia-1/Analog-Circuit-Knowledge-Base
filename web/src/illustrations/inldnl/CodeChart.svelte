<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';

  /**
   * A per-code quantity against code number. There are more codes than pixels, so each pixel column is drawn from the
   * lowest to the highest value it covers: that draws the stems of DNL and the curve of INL with the same path.
   */
  let { truth, measured, n, unit, hover, onhover, label }: {
    truth: ArrayLike<number>;
    measured: ArrayLike<number> | null;
    n: number;
    unit: string;
    hover: number | null;
    onhover: (code: number | null) => void;
    label: string;
  } = $props();

  const X0 = 42;
  const codes = $derived(2 ** n);
  /** Range of the y axis: what the data needs, always including zero, with a little air and a round step. */
  const range = $derived.by(() => {
    let lo = 0, hi = 0;
    for (const a of measured ? [truth, measured] : [truth]) {
      for (let i = 0; i < a.length; i++) {
        lo = Math.min(lo, a[i]);
        hi = Math.max(hi, a[i]);
      }
    }
    const pad = Math.max(0.1, 0.08 * (hi - lo));
    const step = [0.05, 0.1, 0.2, 0.5, 1, 2, 5].find((v) => (hi - lo + 2 * pad) / v <= 6) ?? 10;
    return { lo: Math.floor((lo - pad) / step) * step, hi: Math.ceil((hi + pad) / step) * step, step };
  });

  function stems(a: ArrayLike<number>, cols: number, sy: (v: number) => number) {
    const lo = new Float64Array(cols).fill(Infinity), hi = new Float64Array(cols).fill(-Infinity);
    for (let k = 0; k < a.length; k++) {
      const c = clamp(Math.floor(((k + 0.5) / a.length) * cols), 0, cols - 1);
      if (a[k] < lo[c]) lo[c] = a[k];
      if (a[k] > hi[c]) hi[c] = a[k];
    }
    let d = '';
    for (let c = 0; c < cols; c++) {
      if (hi[c] === -Infinity) continue;
      const x = X0 + c + 0.5, top = sy(hi[c]);
      d += `M${x},${top}V${Math.max(sy(lo[c]), top + 0.6)}`;
    }
    return d;
  }

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 8, Y1 = H - 18, cols = Math.max(1, Math.round(X1 - X0));
    const { lo, hi, step } = range;
    const sx = (c: number) => X0 + (c / codes) * (X1 - X0);
    const sy = (v: number) => Y0 + ((hi - clamp(v, lo, hi)) / (hi - lo)) * (Y1 - Y0);
    const grid: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) grid.push(Number(v.toFixed(2)));
    const ticks = X1 - X0 < 280 ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
    return { X1, Y0, Y1, sx, sy, grid, ticks, dTruth: stems(truth, cols, sy), dMeas: measured && stems(measured, cols, sy) };
  }

  const at = (a: ArrayLike<number>, code: number) => a[clamp(Math.round((code / codes) * a.length), 0, a.length - 1)];
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 6 ? clamp(Math.round(((px - X0) / (W - 6 - X0)) * codes), 0, codes - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" class:zero={v === 0} x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      <text class="tx" x={X0 - 7} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{v}</text>
    {/each}
    {#each g.ticks as f (f)}
      <text class="tx" x={g.sx(f * codes)} y={height - 4} text-anchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{f * codes}</text>
    {/each}
    <text class="tx2 halo" x={X0 + 6} y={g.Y0 + 10}>{unit}</text>
    {#if g.dMeas}<path class="c2 meas" d={g.dMeas} />{/if}
    <path class="c1" stroke-width="1.4" d={g.dTruth} />
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip
        x={g.sx(hover)}
        y={g.sy(at(truth, hover))}
        {width}
        text="code {hover} · {nf(at(truth, hover), 3)}{measured ? ` measured ${nf(at(measured, hover), 3)}` : ''} LSB"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .meas { stroke-width: 1; opacity: 0.7; }
</style>

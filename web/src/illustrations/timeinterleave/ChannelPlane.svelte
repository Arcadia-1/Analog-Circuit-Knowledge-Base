<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { niceStep } from '../../lib/scale';
  import type { Mismatch, Params } from './model';

  /**
   * Each channel as predict_spurs sees it: gain and skew as one complex gain, g·e^{j2π·fin·skew} less the mean, in
   * percent, and the offset less the common part in a strip beside it. Rings are what was set, orange dots what
   * extract_mismatch_sine measured, blue dots what it still measures after calibration.
   */
  let { truth, measured, left, hover, onhover, label }: {
    truth: Mismatch;
    measured: Params;
    left: Params | null;
    hover: number | null;
    onhover: (channel: number | null) => void;
    label: string;
  } = $props();

  const X0 = 8, Y0 = 8, GAP = 34;

  const mean = (a: ArrayLike<number>) => Array.from(a).reduce((s, v) => s + v, 0) / a.length;

  /** Percent: the complex gain of each channel, less the mean over channels. */
  function plane(gain: Float64Array, skew: Float64Array, fin: number) {
    const g = mean(gain);
    const re = Array.from(gain, (v, c) => (v / g) * Math.cos(2 * Math.PI * fin * skew[c]));
    const im = Array.from(gain, (v, c) => (v / g) * Math.sin(2 * Math.PI * fin * skew[c]));
    const r = mean(re), i = mean(im);
    return re.map((v, c) => ({ re: (v - r) * 100, im: (im[c] - i) * 100 }));
  }
  /** Millivolts, less the part all channels share. */
  const ac = (offset: Float64Array) => {
    const o = mean(offset);
    return Array.from(offset, (v) => (v - o) * 1e3);
  };

  const m = $derived(measured.gain.length);
  const pts = $derived({
    set: plane(truth.gain, truth.skew, measured.fin),
    got: plane(measured.gain, measured.skew, measured.fin),
    after: left ? plane(left.gain, left.skew, measured.fin) : null,
  });
  const offs = $derived({ set: ac(truth.offset), got: ac(measured.offset), after: left ? ac(left.offset) : null });
  // one scale for all three sets of dots, so a calibration that makes things worse shows it
  const lim = $derived(niceStep(Math.max(0.01, ...[...pts.set, ...pts.got, ...(pts.after ?? [])].flatMap((p) => [Math.abs(p.re), Math.abs(p.im)])) * 1.1));
  const limO = $derived(niceStep(Math.max(0.01, ...offs.set.map(Math.abs), ...offs.got.map(Math.abs), ...(offs.after ?? []).map(Math.abs)) * 1.1));

  function geo(W: number, H: number) {
    const side = Math.max(60, Math.min(H - Y0 - 22, (W - X0) * 0.58));
    const cx = X0 + side / 2, cy = Y0 + side / 2;
    const px = (v: number) => cx + (v / lim) * (side / 2);
    const py = (v: number) => cy - (v / lim) * (side / 2);
    const S0 = X0 + side + GAP + 30, S1 = W - 8;
    const row = (H - Y0 - 34) / m;
    const ox = (v: number) => (S0 + S1) / 2 + (v / limO) * ((S1 - S0) / 2);
    const oy = (c: number) => Y0 + (c + 0.5) * row;
    return { side, cx, cy, px, py, S0, S1, row, ox, oy };
  }

  function move(x: number, W: number, H: number, y: number) {
    const g = geo(W, H);
    if (x >= g.S0 - 30) {
      const c = Math.floor((y - Y0) / g.row);
      onhover(c >= 0 && c < m ? c : null);
      return;
    }
    let best: number | null = null, dist = 24;
    pts.got.forEach((p, c) => {
      const d = Math.hypot(g.px(p.re) - x, g.py(p.im) - y);
      if (d < dist) [best, dist] = [c, d];
    });
    onhover(best);
  }

  const pct = (v: number) => `${v > 0 ? '+' : ''}${nf(v, 3)} %`;
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <rect class="frame" x={X0} y={Y0} width={g.side} height={g.side} />
    <line class="gr" x1={X0} y1={g.py(lim / 2)} x2={X0 + g.side} y2={g.py(lim / 2)} />
    <line class="gr" x1={X0} y1={g.py(-lim / 2)} x2={X0 + g.side} y2={g.py(-lim / 2)} />
    <line class="gr" x1={g.px(lim / 2)} y1={Y0} x2={g.px(lim / 2)} y2={Y0 + g.side} />
    <line class="gr" x1={g.px(-lim / 2)} y1={Y0} x2={g.px(-lim / 2)} y2={Y0 + g.side} />
    <line class="zero" x1={X0} y1={g.cy} x2={X0 + g.side} y2={g.cy} />
    <line class="zero" x1={g.cx} y1={Y0} x2={g.cx} y2={Y0 + g.side} />
    <text class="tx" x={X0 + g.side} y={Y0 + g.side + 14} text-anchor="end">+{nf(lim, lim < 0.1 ? 2 : 1)} %</text>
    <text class="tx" x={X0} y={Y0 + g.side + 14}>−{nf(lim, lim < 0.1 ? 2 : 1)}</text>
    <text class="tx2 halo" x={X0 + g.side - 4} y={g.cy - 6} text-anchor="end">gain</text>
    <text class="tx2 halo" x={g.cx + 6} y={Y0 + 12}>2π·fin·skew</text>
    {#each pts.set as p, c (c)}
      <circle class="set" cx={g.px(p.re)} cy={g.py(p.im)} r="6" />
    {/each}
    {#each pts.got as p, c (c)}
      <circle class={hover === c ? 'f2 ring' : 'f2'} cx={g.px(p.re)} cy={g.py(p.im)} r={hover === c ? 4.5 : 3} />
      <text class="tx" x={g.px(p.re) + 8} y={g.py(p.im) - 6}>{c}</text>
    {/each}
    {#if pts.after}
      {#each pts.after as p, c (c)}
        <circle class="f1 ring" cx={g.px(p.re)} cy={g.py(p.im)} r="3.5" />
      {/each}
    {/if}

    <line class="zero" x1={g.ox(0)} y1={Y0} x2={g.ox(0)} y2={Y0 + g.row * m} />
    <line class="gr" x1={g.ox(-limO)} y1={Y0} x2={g.ox(-limO)} y2={Y0 + g.row * m} />
    <line class="gr" x1={g.ox(limO)} y1={Y0} x2={g.ox(limO)} y2={Y0 + g.row * m} />
    <text class="tx" x={g.S1} y={height - 5} text-anchor="end">+{nf(limO, limO < 0.1 ? 2 : 1)}</text>
    <text class="tx" x={g.S0} y={height - 5}>−{nf(limO, limO < 0.1 ? 2 : 1)}</text>
    <text class="tx2" x={g.S1} y={height - 18} text-anchor="end">offset, mV</text>
    {#each offs.got as v, c (c)}
      {#if hover === c}<rect class="row" x={g.S0 - 30} y={g.oy(c) - g.row / 2} width={g.S1 - g.S0 + 30} height={g.row} />{/if}
      <text class="tx" x={g.S0 - 12} y={g.oy(c)} text-anchor="end" dominant-baseline="central">{c}</text>
      <circle class="set" cx={g.ox(offs.set[c])} cy={g.oy(c)} r="6" />
      <circle class="f2" cx={g.ox(v)} cy={g.oy(c)} r="3" />
      {#if offs.after}<circle class="f1 ring" cx={g.ox(offs.after[c])} cy={g.oy(c)} r="3.5" />{/if}
    {/each}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const p = pts.got[hover]}
      <Tip
        x={g.px(p.re)}
        y={g.py(p.im)}
        {width}
        text="channel {hover} · gain {pct((measured.gain[hover] - 1) * 100)} · skew {nf(measured.skew[hover] * 1e12, 2)} ps · offset {nf(offs.got[hover], 2)} mV · set: {pct((truth.gain[hover] / mean(truth.gain) - 1) * 100)}, {nf(truth.skew[hover] * 1e12, 2)} ps, {nf(offs.set[hover], 2)} mV"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .frame { fill: none; stroke: var(--rule); }
  .set { fill: none; stroke: var(--ink-3); stroke-width: 1.2; }
  .row { fill: var(--chip); }
</style>

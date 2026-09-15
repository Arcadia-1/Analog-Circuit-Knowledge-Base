<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp, symlog } from '../../lib/scale';
  import type { Trial } from './model';

  /**
   * Residue V_in − V_test at each comparison on a symmetric log axis. Bars span the DAC levels the remaining capacitors can
   * still reach; once V_in falls outside a bar, no digital weights can recover the conversion.
   */
  let { trace, x, n, slots, shown, series, hover, onhover, label }: {
    trace: Trial[];
    x: number;
    n: number;
    slots: number;
    shown: number;
    series: 1 | 2;
    hover: number | null;
    onhover: (k: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46;

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 30, Y1 = H - 20, cw = (X1 - X0) / slots;
    const ymax = symlog(0.56 * 2 ** n);
    const ys = (v: number) => Y0 + ((ymax - symlog(v)) / (2 * ymax)) * (Y1 - Y0);
    const yc = (v: number) => clamp(ys(v), Y0, Y1);
    const xc = (k: number) => X0 + (k + 0.5) * cw;
    const ticks: number[] = [0];
    for (let v = 1, last = ys(0); v <= 2 ** (n - 1); v *= 4) {
      if (last - ys(v) < 15) continue;
      ticks.push(v, -v);
      last = ys(v);
    }
    const top = Math.max(...ticks);
    const vis = trace.slice(0, Math.min(shown, trace.length));
    const path = vis.map((t, k) => `${k ? 'L' : 'M'}${xc(k)},${ys(x - t.test)}`).join('');
    const every = cw < 22 ? 2 : 1;
    return { X1, Y0, Y1, cw, ys, yc, xc, ticks, top, vis, path, every };
  }

  function move(px: number, W: number) {
    const k = Math.floor((px - X0) / ((W - 6 - X0) / slots));
    onhover(k >= 0 && k < Math.min(shown, trace.length) ? k : null);
  }
  const reachable = (t: Trial) => t.lo < x && x < t.hi;
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as v (v)}
      <line class={v === 0 ? 'zero' : 'gr'} x1={X0} y1={g.ys(v)} x2={g.X1} y2={g.ys(v)} />
      <text class="tx" x="40" y={g.ys(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}{v === g.top ? ' LSB' : ''}</text>
    {/each}
    <text class="tx2 halo" x={g.X1} y={g.ys(0) - 6} text-anchor="end">V<tspan font-size="9" dy="2">in</tspan></text>
    {#each Array.from({ length: slots }, (_, k) => k) as k (k)}
      {#if k < trace.length}
        {#if k < shown}
          {@const t = trace[k]}
          <text class="bit mono {t.bit !== t.ideal ? 'f-bad' : 'tx-ink'}" x={g.xc(k)} y="12" text-anchor="middle" dominant-baseline="central">{t.bit}</text>
          <rect
            class={reachable(t) ? 'window' : 'window lost'}
            x={g.xc(k) - Math.min(9, g.cw * 0.28)}
            y={g.yc(x - t.lo)}
            width={Math.min(18, g.cw * 0.56)}
            height={Math.max(1, g.yc(x - t.hi) - g.yc(x - t.lo))}
            rx="2"
          />
        {:else}
          <text class="tx" x={g.xc(k)} y="12" text-anchor="middle" dominant-baseline="central">·</text>
        {/if}
      {/if}
      {#if (k + 1) % g.every === 0 || k === 0}
        <text class="tx" x={g.xc(k)} y={height - 5} text-anchor="middle">{k + 1}</text>
      {/if}
    {/each}
    <path class="c{series} link" d={g.path} />
    {#each g.vis as t, k (k)}
      <circle class="f{series} ring" cx={g.xc(k)} cy={g.ys(x - t.test)} r="4" />
      {#if t.bit !== t.ideal}<circle class="bad" stroke-width="1.75" cx={g.xc(k)} cy={g.ys(x - t.test)} r="7.5" />{/if}
    {/each}
    {#if hover !== null}<line class="cross" x1={g.xc(hover)} y1={g.Y0 - 6} x2={g.xc(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && trace[hover]}
      {@const g = geo(width, height)}
      {@const t = trace[hover]}
      <Tip
        x={g.xc(hover)}
        y={Math.min(g.ys(x - t.test), g.Y0 + 30)}
        {width}
        text="comparison {hover + 1} · DAC {nf(t.test, 1)} · residue {nf(x - t.test, 1)} LSB · bit {t.bit}{t.bit !== t.ideal ? ' (noise)' : ''}"
      />
    {/if}
  {/snippet}
</Plot>

<style>
  .bit { font-size: 12px; }
  .link { stroke-width: 1.25; opacity: 0.45; }
  .window { fill: var(--chip); }
  .lost { fill: var(--bad); fill-opacity: 0.12; stroke: var(--bad); stroke-width: 1; stroke-opacity: 0.6; }
</style>

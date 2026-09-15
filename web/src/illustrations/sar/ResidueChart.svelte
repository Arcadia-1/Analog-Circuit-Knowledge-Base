<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { symlog } from '../../lib/scale';
  import type { Step } from './model';

  /**
   * Residue V_in − V_DAC at each comparison on a symmetric log axis. Bars show every DAC level the remaining steps
   * can still reach; when V_in (the zero line) falls outside, the conversion can no longer come out right.
   */
  let { steps, x, n, slots, shown, series, hover, onhover, label }: {
    steps: Step[];
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
  const code = $derived(Math.floor(x));

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 30, Y1 = H - 20, cw = (X1 - X0) / slots;
    const ymax = symlog(2 ** (n - 1) + 2);
    const ys = (v: number) => Y0 + ((ymax - symlog(v)) / (2 * ymax)) * (Y1 - Y0);
    const xc = (k: number) => X0 + (k + 0.5) * cw;
    const ticks: number[] = [0];
    for (let v = 1, last = ys(0); v <= 2 ** (n - 1); v *= 4) {
      if (last - ys(v) < 13) continue;
      ticks.push(v, -v);
      last = ys(v);
    }
    const top = Math.max(...ticks);
    const vis = steps.slice(0, Math.min(shown, steps.length));
    const path = vis.map((s, k) => `${k ? 'L' : 'M'}${xc(k)},${ys(x - s.t)}`).join('');
    const every = cw < 22 ? 2 : 1;
    return { X1, Y0, Y1, cw, ys, xc, ticks, top, vis, path, every };
  }

  function move(px: number, W: number) {
    const k = Math.floor((px - X0) / ((W - 6 - X0) / slots));
    onhover(k >= 0 && k < Math.min(shown, steps.length) ? k : null);
  }
  const recoverable = (s: Step) => s.lo <= code && code <= s.hi;
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
      {#if k < steps.length}
        {#if k < shown}
          {@const s = steps[k]}
          <text class="bit mono {s.b !== s.ideal ? 'f-bad' : 'tx-ink'}" x={g.xc(k)} y="12" text-anchor="middle" dominant-baseline="central">{s.b}</text>
          <rect
            class={recoverable(s) ? 'window' : 'window lost'}
            x={g.xc(k) - Math.min(9, g.cw * 0.28)}
            y={g.ys(x - s.lo)}
            width={Math.min(18, g.cw * 0.56)}
            height={Math.max(1, g.ys(x - s.hi - 1) - g.ys(x - s.lo))}
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
    {#each g.vis as s, k (k)}
      {#if Math.abs(s.seen - s.t) > 0.02}
        <line class="c{series}" stroke-width="2" x1={g.xc(k)} y1={g.ys(x - s.t)} x2={g.xc(k)} y2={g.ys(x - s.seen)} />
      {/if}
      <circle class="f{series} ring" cx={g.xc(k)} cy={g.ys(x - s.t)} r="4" />
      {#if s.b !== s.ideal}<circle class="bad" stroke-width="1.75" cx={g.xc(k)} cy={g.ys(x - s.t)} r="7.5" />{/if}
    {/each}
    {#if hover !== null}<line class="cross" x1={g.xc(hover)} y1={g.Y0 - 6} x2={g.xc(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null && steps[hover]}
      {@const g = geo(width, height)}
      {@const s = steps[hover]}
      <Tip
        x={g.xc(hover)}
        y={Math.min(g.ys(x - s.t), g.Y0 + 30)}
        {width}
        text="comparison {hover + 1} · DAC {nf(s.t, 0)} · residue {nf(x - s.t, 1)} LSB · bit {s.b}{s.b !== s.ideal ? ' (wrong)' : ''}"
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

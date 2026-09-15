<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp, niceStep } from '../../lib/scale';
  import { N_SHOW, type EdgeScale, type Sim } from './model';

  let {
    sim,
    series,
    scale,
    ghost = false,
    hover,
    onhover,
    label,
  }: {
    sim: Sim;
    series: 1 | 2;
    scale: EdgeScale;
    ghost?: boolean;
    hover: number | null;
    onhover: (i: number | null) => void;
    label: string;
  } = $props();

  const X0 = 46;
  const ghostPs = $derived.by(() => {
    let m = 0;
    for (let i = 0; i < N_SHOW; i++) m += sim.qd[i];
    m /= N_SHOW;
    return Array.from(sim.qd, (v) => (v - m) * 1e12);
  });

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 44, Y1 = H - 20, cw = (X1 - X0) / N_SHOW, R = scale.R;
    const step = niceStep((2 * R) / Math.max(2, Math.floor((Y1 - Y0) / 24)));
    const m = Math.floor(R / step + 1e-9), top = m * step;
    const ticks = Array.from({ length: 2 * m + 1 }, (_, i) => (i - m) * step);
    const xc = (i: number) => X0 + (i + 0.5) * cw;
    const yN = (n: number) => (scale.nMax === scale.nMin ? 17 : 30 - ((n - scale.nMin) / (scale.nMax - scale.nMin)) * 26);
    const yE = (v: number) => Y0 + ((R - clamp(v, -R, R)) / (2 * R)) * (Y1 - Y0);
    let steps = '';
    for (let i = 0; i < N_SHOW; i++) {
      const y = yN(sim.ndiv[i]);
      steps += `${i ? 'L' : 'M'}${X0 + i * cw},${y}L${X0 + (i + 1) * cw},${y}`;
    }
    const xTicks = X1 - X0 < 420 ? [0, 40, 80] : [0, 20, 40, 60, 80];
    return { X1, Y0, Y1, cw, R, top, ticks, xc, yN, yE, steps, xTicks, T: sim.tOut * 1e12 };
  }

  function move(x: number, W: number) {
    const i = Math.floor((x - X0) / ((W - 6 - X0) / N_SHOW));
    onhover(i >= 0 && i < N_SHOW ? i : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <text class="tx" x="40" y={g.yN(scale.nMax)} text-anchor="end" dominant-baseline="central">÷{scale.nMax}</text>
    {#if scale.nMin !== scale.nMax}
      <text class="tx" x="40" y={g.yN(scale.nMin)} text-anchor="end" dominant-baseline="central">÷{scale.nMin}</text>
    {/if}
    <path class="c{series}" stroke-width="1.75" stroke-linejoin="round" d={g.steps} />
    {#each g.ticks as v (v)}
      <line class={v === 0 ? 'zero' : 'gr'} x1={X0} y1={g.yE(v)} x2={g.X1} y2={g.yE(v)} />
      <text class="tx" x="40" y={g.yE(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}{v === g.top ? ' ps' : ''}</text>
    {/each}
    {#if g.T < g.R * 0.98}
      <line class="guide" x1={X0} y1={g.yE(g.T)} x2={g.X1} y2={g.yE(g.T)} />
      <line class="guide" x1={X0} y1={g.yE(-g.T)} x2={g.X1} y2={g.yE(-g.T)} />
      <text class="tx2 halo" x={g.X1} y={g.yE(g.T) + 14} text-anchor="end">±1 VCO period</text>
    {/if}
    {#if ghost}
      {#each ghostPs as v, i (i)}<circle class="ghost" cx={g.xc(i)} cy={g.yE(v)} r="2.2" />{/each}
    {/if}
    {#each sim.e as ev, i (i)}
      <line class="c{series}" stroke-width="2" stroke-linecap="round" x1={g.xc(i)} y1={g.yE(0)} x2={g.xc(i)} y2={g.yE(ev * 1e12)} />
      <circle class="f{series}" cx={g.xc(i)} cy={g.yE(ev * 1e12)} r="2.6" />
    {/each}
    {#each g.xTicks as c (c)}
      <text class="tx" x={X0 + c * g.cw} y={height - 5} text-anchor={c === 80 ? 'end' : 'middle'}>{c}{c === 80 ? ' cycles' : ''}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.xc(hover)} y1="4" x2={g.xc(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      <Tip x={g.xc(hover)} y={Math.min(g.yE(sim.e[hover] * 1e12), g.Y0 + 24)} {width} text="cycle {hover} · ÷{sim.ndiv[hover]} · {nf(sim.e[hover] * 1e12, 1)} ps" />
    {/if}
  {/snippet}
</Plot>

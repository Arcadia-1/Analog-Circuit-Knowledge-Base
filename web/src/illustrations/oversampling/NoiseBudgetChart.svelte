<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import { FS, N, type NoiseBudget } from './model';

  let { budget, osr, hover, onhover, label }: {
    budget: NoiseBudget;
    osr: number;
    hover: number | null;
    onhover: (bin: number | null) => void;
    label: string;
  } = $props();

  const X0 = 47, HALF = N / 2;
  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, split = Y0 + (Y1 - Y0) * .5;
    const sx = (bin: number) => X0 + (Math.log10(Math.max(1, bin)) / Math.log10(HALF)) * (X1 - X0);
    const syNtf = (db: number) => Y0 + ((20 - clamp(db, -140, 20)) / 160) * (split - 8 - Y0);
    const syCum = (db: number) => split + 8 + ((0 - clamp(db, -120, 0)) / 120) * (Y1 - split - 8);
    let ntf = '', cumulative = '';
    const stride = 4;
    for (let i = 0; i < budget.bins.length; i += stride) {
      ntf += `${i ? 'L' : 'M'}${sx(budget.bins[i]).toFixed(1)},${syNtf(budget.ntfDb[i]).toFixed(1)}`;
      cumulative += `${i ? 'L' : 'M'}${sx(budget.bins[i]).toFixed(1)},${syCum(budget.cumulativeDb[i]).toFixed(1)}`;
    }
    const edge = Math.max(1, Math.floor(HALF / osr));
    return { X1, Y0, Y1, split, sx, syNtf, syCum, ntf, cumulative, edge };
  }

  function move(px: number, W: number) {
    const X1 = W - 8;
    onhover(px >= X0 && px <= X1 ? clamp(Math.round(HALF ** ((px - X0) / (X1 - X0))), 1, HALF) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    <rect class="band" x={X0} y={g.Y0} width={g.sx(g.edge) - X0} height={g.Y1 - g.Y0} />
    {#each [-120, -80, -40, 0] as db}
      <line class="gr" x1={X0} x2={g.X1} y1={g.syNtf(db)} y2={g.syNtf(db)} />
      <text class="tx" x={X0 - 6} y={g.syNtf(db)} text-anchor="end" dominant-baseline="central">{db}</text>
    {/each}
    {#each [-120, -80, -40, 0] as db}
      <line class="gr" x1={X0} x2={g.X1} y1={g.syCum(db)} y2={g.syCum(db)} />
      <text class="tx" x={X0 - 6} y={g.syCum(db)} text-anchor="end" dominant-baseline="central">{db}</text>
    {/each}
    <line class="edge" x1={g.sx(g.edge)} x2={g.sx(g.edge)} y1={g.Y0} y2={g.Y1} />
    <path class="c1" stroke-width="1.8" d={g.ntf} />
    <path class="c2" stroke-width="1.8" d={g.cumulative} />
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 11}>|NTF|, dB</text>
    <text class="tx2 halo" x={X0 + 5} y={g.split + 19}>noise accumulated from DC, dB of total</text>
    <text class="tx halo" x={g.sx(g.edge) - 5} y={g.Y1 - 6} text-anchor="end">band edge</text>
    {#each [1e5, 1e6, 1e7] as frequency}
      {@const bin = (frequency * N) / FS}
      {#if bin <= HALF}<text class="tx" x={g.sx(bin)} y={height - 5} text-anchor="middle">{freqText(frequency)}</text>{/if}
    {/each}
    <text class="tx" x={g.X1} y={height - 5} text-anchor="end">50 MHz</text>
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} x2={g.sx(hover)} y1={g.Y0} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const index = clamp(hover - 1, 0, budget.bins.length - 1)}
      <Tip x={g.sx(hover)} y={g.syCum(budget.cumulativeDb[index])} {width} text="{freqText((hover * FS) / N)} · |NTF| {nf(budget.ntfDb[index], 1)} dB · cumulative noise {nf(budget.cumulativeDb[index], 1)} dB of total" />
    {/if}
  {/snippet}
</Plot>

<style>
  .band { fill: var(--s1-soft); opacity: .65; }
  .edge { stroke: var(--ink-2); stroke-dasharray: 4 3; }
</style>

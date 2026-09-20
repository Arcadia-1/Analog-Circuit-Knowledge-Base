<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { nf } from '../../lib/format';
  import { clamp, niceStep } from '../../lib/scale';
  import { AMP, FS, type Mismatch } from './model';

  let { raw, corrected, truth, fin, method, hover, onhover, label }: {
    raw: Float64Array;
    corrected: Float64Array;
    truth: Mismatch;
    fin: number;
    method: string;
    hover: number | null;
    onhover: (index: number | null) => void;
    label: string;
  } = $props();

  const X0 = 45, COUNT = 48;
  const m = $derived(truth.gain.length);
  const ideal = (i: number) => AMP * Math.cos((2 * Math.PI * fin * i) / FS);
  const rawError = $derived(Float64Array.from({ length: COUNT }, (_, i) => (raw[i] - ideal(i)) * 1e3));
  const fixedError = $derived(Float64Array.from({ length: COUNT }, (_, i) => (corrected[i] - ideal(i)) * 1e3));

  function geo(W: number, H: number) {
    const X1 = W - 8, Y0 = 8, Y1 = H - 20, split = Y0 + (Y1 - Y0) * .58;
    const sx = (i: number) => X0 + ((i + .5) / COUNT) * (X1 - X0);
    const sy = (v: number) => Y0 + ((.5 - clamp(v, -.5, .5)) / 1) * (split - 9 - Y0);
    const limit = niceStep(Math.max(0.05, ...rawError, ...fixedError.map(Math.abs), ...rawError.map(Math.abs)) * 1.1);
    const sr = (mv: number) => split + 8 + ((limit - clamp(mv, -limit, limit)) / (2 * limit)) * (Y1 - split - 8);
    let wave = '', fixed = '', rawResidual = '', fixedResidual = '';
    for (let i = 0; i <= 400; i++) {
      const at = ((COUNT - 1) * i) / 400;
      wave += `${i ? 'L' : 'M'}${sx(at).toFixed(1)},${sy(ideal(at)).toFixed(1)}`;
    }
    for (let i = 0; i < COUNT; i++) {
      fixed += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(corrected[i]).toFixed(1)}`;
      rawResidual += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sr(rawError[i]).toFixed(1)}`;
      fixedResidual += `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sr(fixedError[i]).toFixed(1)}`;
    }
    return { X1, Y0, Y1, split, limit, sx, sy, sr, wave, fixed, rawResidual, fixedResidual };
  }
</script>

<Plot
  {label}
  onpointermove={(px, W) => onhover(px >= X0 && px <= W - 8 ? clamp(Math.floor(((px - X0) / (W - 8 - X0)) * COUNT), 0, COUNT - 1) : null)}
  onpointerleave={() => onhover(null)}
>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each [-.5, 0, .5] as v}
      <line class={v ? 'gr' : 'zero'} x1={X0} x2={g.X1} y1={g.sy(v)} y2={g.sy(v)} />
      <text class="tx" x={X0 - 6} y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 1)}</text>
    {/each}
    {#each [-g.limit, 0, g.limit] as mv}
      <line class={mv ? 'gr' : 'zero'} x1={X0} x2={g.X1} y1={g.sr(mv)} y2={g.sr(mv)} />
      <text class="tx" x={X0 - 6} y={g.sr(mv)} text-anchor="end" dominant-baseline="central">{nf(mv, mv < 1 ? 2 : 0)}</text>
    {/each}
    <path class="ideal" d={g.wave} />
    {#if method !== 'off'}<path class="c1" stroke-width="1.8" d={g.fixed} />{/if}
    {#each raw.subarray(0, COUNT) as value, i}
      {@const c = i % m}
      <line class="sample-stem" x1={g.sx(i)} x2={g.sx(i + truth.skew[c] * FS)} y1={g.sy(value)} y2={g.sy(value)} />
      <circle class="sample ch{c % 4}" cx={g.sx(i + truth.skew[c] * FS)} cy={g.sy(value)} r={hover === i ? 4.5 : 2.8} />
      {#if i < m}<text class="tx channel" x={g.sx(i + truth.skew[c] * FS)} y={g.Y0 + 10} text-anchor="middle">{c}</text>{/if}
    {/each}
    <path class="c2" stroke-width="1.2" d={g.rawResidual} />
    {#if method !== 'off'}<path class="c1" stroke-width="1.7" d={g.fixedResidual} />{/if}
    <text class="tx2 halo" x={X0 + 5} y={g.Y0 + 11}>input and channel samples, V</text>
    <text class="tx2 halo" x={X0 + 5} y={g.split + 18}>error at the nominal sample time, mV</text>
    {#each [0, 12, 24, 36, 47] as i, k}
      <text class="tx" x={g.sx(i)} y={height - 5} text-anchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>{k === 4 ? `${i} samples` : i}</text>
    {/each}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} x2={g.sx(hover)} y1={g.Y0} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const c = hover % m}
      <Tip x={g.sx(hover)} y={g.sy(raw[hover])} {width} text="sample {hover}, channel {c} · skew {nf(truth.skew[c] * 1e12, 2)} ps · raw error {nf(rawError[hover], 2)} mV{method === 'off' ? '' : ` · after ${nf(fixedError[hover], 2)} mV`}" />
    {/if}
  {/snippet}
</Plot>

<style>
  .ideal { fill: none; stroke: var(--ink-3); stroke-width: 1.2; }
  .sample-stem { stroke: var(--ink-3); opacity: .45; }
  .sample { stroke: var(--plot); stroke-width: 1.2; }
  .ch0 { fill: var(--s1); }
  .ch1 { fill: var(--s2); }
  .ch2 { fill: var(--ink-2); }
  .ch3 { fill: var(--ghost); }
  .channel { fill: var(--ink-2); }
</style>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { FN, responseDb, type LinkAnalysis } from './model';

  let { a }: { a: LinkAnalysis } = $props();
  const left = 38, right = 10, top = 10, lo = -50, hi = 10, fmax = 56e9;
  const ticks = [-50, -40, -30, -20, -10, 0, 10];
  const freqs = [0, 14, 28, 42, 56];
  const curves = $derived.by(() => {
    const channel = a.stages.channel.slice(1), ctle = [a.stages.rx[1]], link = a.stages.channel.concat(a.stages.rx);
    const sample = (st: typeof link) => Array.from({ length: 113 }, (_, i) => {
      const f = Math.max(1e7, i * 0.5e9);
      return [f, responseDb(st, f)] as const;
    });
    return { channel: sample(channel), ctle: sample(ctle), link: sample(link), atFn: [responseDb(channel, FN), responseDb(ctle, FN), responseDb(link, FN)] };
  });
  const x = (f: number, w: number) => left + (f / fmax) * Math.max(1, w - left - right);
  const y = (db: number, h: number) => top + ((hi - Math.min(hi, Math.max(lo - 4, db))) / (hi - lo)) * Math.max(1, h - top - 22);
  const path = (pts: readonly (readonly [number, number])[], w: number, h: number) => pts.map(([f, db], i) => `${i ? 'L' : 'M'}${x(f, w).toFixed(1)},${y(db, h).toFixed(1)}`).join('');
</script>

<Plot label="Frequency response of the channel, the CTLE and the whole link up to the ADC, 0 to 56 GHz">
  {#snippet children({ width: w, height: h })}
    {#if w > 0 && h > 60}
      {#each ticks as db (db)}
        <line class={db === 0 ? 'zero' : 'gr'} x1={left} x2={w - right} y1={y(db, h)} y2={y(db, h)} />
        {#if db % 20 === 0 || h > 150}<text class="tx" text-anchor="end" x={left - 6} y={y(db, h) + 4}>{db === 0 ? '0 dB' : db}</text>{/if}
      {/each}
      {#each freqs as f (f)}
        <text class="tx" text-anchor={f === 56 ? 'end' : f === 0 ? 'start' : 'middle'} x={x(f * 1e9, w)} y={h - 5}>{f === 56 ? '56 GHz' : f}</text>
      {/each}
      <line class="guide" x1={x(FN, w)} x2={x(FN, w)} y1={top} y2={h - 22} stroke-dasharray="3 3" />
      <text class="tx2" x={x(FN, w) + 4} y={top + 10}>f<tspan font-size="0.7em" dy="2">N</tspan></text>
      <path class="guide" d={path(curves.channel, w, h)} stroke-width="1.6" fill="none" />
      <path class="c2" d={path(curves.ctle, w, h)} stroke-width="1.6" />
      <path class="c1" d={path(curves.link, w, h)} stroke-width="2" />
      <circle class="ghost" cx={x(FN, w)} cy={y(curves.atFn[0], h)} r="3" />
      <circle class="f2" cx={x(FN, w)} cy={y(curves.atFn[1], h)} r="3" />
      <circle class="f1" cx={x(FN, w)} cy={y(curves.atFn[2], h)} r="3" />
    {/if}
  {/snippet}
</Plot>

<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { FLIT, FLIT_TLP, codeEfficiency, payloadShare, type Generation } from './model';

  /** Payload share of the line rate against payload size, with the ceiling the line code leaves. */
  let { g, header, payload }: { g: Generation; header: number; payload: number } = $props();
  const left = 36, right = 8, top = 8, bottom = 20, sizes = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const x = (b: number, w: number) => left + ((Math.log2(b) - 4) / 8) * Math.max(1, w - left - right);
  const y = (v: number, h: number) => top + (1 - v) * Math.max(1, h - top - bottom);
  const ceiling = $derived(g.code === 'flit' ? FLIT_TLP / FLIT : codeEfficiency(g.code));
  const curve = $derived(Array.from({ length: 81 }, (_, i) => 2 ** (4 + i / 10)).map((b) => ({ b, v: payloadShare(g, b, header) })));
  const label = (b: number) => (b >= 1024 ? `${b / 1024}k` : `${b}`);
</script>

<Plot label="Share of the line rate that is payload, against payload size">
  {#snippet children({ width: w, height: h })}
    {#if w > 0 && h > 60}
      {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
        <line class="gr" x1={left} x2={w - right} y1={y(v, h)} y2={y(v, h)} />
        <text class="tx" text-anchor="end" x={left - 6} y={y(v, h) + 4}>{v * 100}%</text>
      {/each}
      {#each sizes as b (b)}
        <text class="tx" text-anchor={b === 16 ? 'start' : b === 4096 ? 'end' : 'middle'} x={x(b, w)} y={h - 4}>{label(b)}</text>
      {/each}
      <line class="c2" x1={left} x2={w - right} y1={y(ceiling, h)} y2={y(ceiling, h)} stroke-dasharray="4 3" />
      <path class="c1" stroke-width="2" d={curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.b, w).toFixed(1)},${y(p.v, h).toFixed(1)}`).join('')} />
      <circle class="f2" cx={x(payload, w)} cy={y(payloadShare(g, payload, header), h)} r="4.5" />
    {/if}
  {/snippet}
</Plot>

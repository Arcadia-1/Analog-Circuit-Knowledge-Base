<script lang="ts">
  import SliderRuler from '../../components/chart/SliderRuler.svelte';

  /** Input voltage over a 6-bit grid, with output codes marked and analog DAC errors above one LSB shaded. */
  let { vin, n, codeA, codeB, gaps, onchange }: {
    vin: number;
    n: number;
    codeA: number;
    codeB: number;
    /** per lane, the input ranges the converter cannot resolve, as fractions of full scale */
    gaps: [number, number][][];
    onchange: (v: number) => void;
  } = $props();

  const LEVELS = Array.from({ length: 63 }, (_, i) => (i + 1) / 64);
  const LANES = [48, 59];
  const mid = (code: number) => (code + 0.5) / 2 ** n;

  /** Flagged ranges can be thinner than a pixel; shade each pixel by the covered fraction. */
  function shade(bands: [number, number][], W: number): number[] {
    const px = new Array(Math.max(1, Math.round(W))).fill(0);
    for (const [a, b] of bands) {
      const lo = a * px.length, hi = b * px.length;
      for (let k = Math.floor(lo); k < Math.min(px.length, Math.ceil(hi)); k++) px[k] += Math.min(hi, k + 1) - Math.max(lo, k);
    }
    return px;
  }
</script>

<SliderRuler value={vin} min={0} max={1} step={0.0001} label="Input voltage in volts" {onchange}>
  {#snippet children({ W, X })}
    <line class="base" x1="0" y1="28" x2={W} y2="28" />
    {#each LEVELS as v (v)}<line class="tick" opacity="0.6" x1={X(v)} y1="24" x2={X(v)} y2="28" />{/each}
    {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
      <line class="major" x1={X(v)} y1="18" x2={X(v)} y2="28" />
      <text class="tx" x={X(v)} y="10" text-anchor={v === 0 ? 'start' : v === 1 ? 'end' : 'middle'}>{v.toFixed(2)} V</text>
    {/each}
    {#each LANES as y, i (y)}
      <line class="lane c{i + 1}" x1="0" y1={y} x2={W} y2={y} />
      {#each shade(gaps[i], W) as v, k (k)}
        {#if v > 0}<rect class="gap" x={(k * W) / Math.round(W)} y={y - 4} width={W / Math.round(W)} height="8" opacity={0.3 + 0.7 * v} />{/if}
      {/each}
    {/each}
    <circle class="f1 ring" cx={X(mid(codeA))} cy="48" r="5" />
    <circle class="f2 ring" cx={X(mid(codeB))} cy="59" r="5" />
  {/snippet}
</SliderRuler>

<style>
  .gap { fill: var(--bad); }
</style>

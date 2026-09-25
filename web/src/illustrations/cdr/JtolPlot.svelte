<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';

  /** Jitter tolerance (UIpp) at each frequency, and the sinusoidal jitter being applied now. */
  let { curve, sjHz, sjUipp }: { curve: { hz: number; uipp: number }[] | null; sjHz: number; sjUipp: number } = $props();
  const left = 40, right = 10, top = 8, bottom = 20, f0 = 1e6, f1 = 1e9, a0 = 0.1, a1 = 20;
  const fTicks = [1e6, 1e7, 1e8, 1e9], aTicks = [0.1, 0.3, 1, 3, 10];
  const x = (hz: number, w: number) => left + (Math.log10(hz / f0) / Math.log10(f1 / f0)) * Math.max(1, w - left - right);
  const y = (a: number, h: number) => top + (Math.log10(a1 / Math.min(a1, Math.max(a0, a))) / Math.log10(a1 / a0)) * Math.max(1, h - top - bottom);
  const fText = (hz: number) => (hz >= 1e9 ? `${hz / 1e9} GHz` : `${hz / 1e6} MHz`);
  /** Tolerance at the applied frequency, interpolated in log-log. */
  const limit = $derived.by(() => {
    if (!curve?.length) return null;
    if (sjHz <= curve[0].hz) return curve[0].uipp;
    for (let i = 1; i < curve.length; i++) {
      if (sjHz <= curve[i].hz) {
        const a = curve[i - 1], b = curve[i], t = Math.log(sjHz / a.hz) / Math.log(b.hz / a.hz);
        return Math.exp(Math.log(Math.max(a.uipp, 1e-3)) * (1 - t) + Math.log(Math.max(b.uipp, 1e-3)) * t);
      }
    }
    return curve[curve.length - 1].uipp;
  });
</script>

<Plot label="Jitter tolerance: the largest sinusoidal jitter the loop survives at each frequency, with the jitter applied now">
  {#snippet children({ width: w, height: h })}
    {#if w > 0 && h > 60}
      {#each aTicks as a (a)}
        <line class="gr" x1={left} x2={w - right} y1={y(a, h)} y2={y(a, h)} />
        <text class="tx" text-anchor="end" x={left - 6} y={y(a, h) + 4}>{a}</text>
      {/each}
      {#each fTicks as f (f)}
        <line class="gr" x1={x(f, w)} x2={x(f, w)} y1={top} y2={h - bottom} />
        <text class="tx" text-anchor={f === f1 ? 'end' : f === f0 ? 'start' : 'middle'} x={x(f, w)} y={h - 4}>{fText(f)}</text>
      {/each}
      {#if curve}
        <path class="c1" stroke-width="2" d={curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.hz, w).toFixed(1)},${y(p.uipp, h).toFixed(1)}`).join('')} />
        {#each curve as p (p.hz)}<circle class="f1" cx={x(p.hz, w)} cy={y(p.uipp, h)} r="2.2" />{/each}
      {:else}
        <text class="tx2" x={left + 8} y={top + 16}>computing…</text>
      {/if}
      {#if sjUipp > 0}
        <circle class={limit !== null && sjUipp > limit ? 'f-bad' : 'f2'} cx={x(sjHz, w)} cy={y(sjUipp, h)} r="4.5" />
      {/if}
    {/if}
  {/snippet}
</Plot>

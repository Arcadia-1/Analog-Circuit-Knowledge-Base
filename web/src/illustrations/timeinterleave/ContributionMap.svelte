<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { freqText, nf } from '../../lib/format';
  import type { Contribution } from './model';

  let { rows, fs, label }: { rows: Contribution[]; fs: number; label: string } = $props();

  function geo(W: number, H: number) {
    const compact = W < 520, X0 = compact ? 94 : 150;
    const X1 = W - (compact ? 62 : 74), Y0 = 8, Y1 = H - 25;
    const sy = (i: number) => Y0 + ((i + 0.5) / rows.length) * (Y1 - Y0);
    const sx = (f: number) => X0 + (f / (fs / 2)) * (X1 - X0);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((v) => v * fs / 2);
    return { compact, X0, X1, Y0, Y1, sx, sy, ticks };
  }

  const level = (row: Contribution) => {
    if (!Number.isFinite(row.level)) return 'off';
    return row.broadband ? `${nf(-row.level, 1)} dB SNR` : `${nf(row.level, 1)} dBc`;
  };
</script>

<Plot {label}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as f, i (f)}
      <line class="gr" x1={g.sx(f)} x2={g.sx(f)} y1={g.Y0} y2={g.Y1} />
      <text class="tx" x={g.sx(f)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{freqText(f)}</text>
    {/each}
    {#each rows as row, i (row.id)}
      <line class="lane" x1={g.X0} x2={g.X1} y1={g.sy(i)} y2={g.sy(i)} />
      <text class="source" x="6" y={g.sy(i) - 4}>{row.label}</text>
      {#if !g.compact}<text class="note" x="6" y={g.sy(i) + 11}>{row.note}</text>{/if}
      <text class="level" x={width - 6} y={g.sy(i)} text-anchor="end" dominant-baseline="central">{level(row)}</text>
      {#if row.broadband && Number.isFinite(row.level)}
        <rect class="floor {row.id}" x={g.X0} y={g.sy(i) - 5} width={g.X1 - g.X0} height="10" />
      {:else}
        {#each row.frequencies as f, k (`${row.id}-${k}`)}
          <line class="stem {row.id}" x1={g.sx(f)} x2={g.sx(f)} y1={g.sy(i) - 8} y2={g.sy(i) + 8} />
          <circle class="tone {row.id}" cx={g.sx(f)} cy={g.sy(i)} r="3.2" />
        {/each}
      {/if}
    {/each}
  {/snippet}
</Plot>

<style>
  .lane { stroke: var(--rule); stroke-width: 1.5; }
  .source { fill: var(--ink); font: 500 13px var(--sans); }
  .note { fill: var(--ink-3); font: 12px var(--sans); }
  .level { fill: var(--ink-2); font: 12px var(--mono); font-variant-numeric: tabular-nums; }
  .stem { stroke-width: 1.5; }
  .tone { stroke: var(--plot); stroke-width: 1.2; }
  .offset { fill: var(--s2); stroke: var(--s2); }
  .gain { fill: var(--s1); stroke: var(--s1); }
  .skew { fill: var(--brand); stroke: var(--brand); }
  .bandwidth { fill: var(--ink-2); stroke: var(--ink-2); }
  .harmonics { fill: var(--bad); stroke: var(--bad); }
  .jitter { fill: var(--s1-soft); stroke: var(--s1); }
  .floor { opacity: .8; }
</style>

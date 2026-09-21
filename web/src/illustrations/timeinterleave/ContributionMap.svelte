<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import { freqText, nf } from '../../lib/format';
  import { frequencyAxis } from './frequencyAxis';
  import type { Contribution } from './model';

  let { rows, fs, points, label }: { rows: Contribution[]; fs: number; points: number; label: string } = $props();

  function geo(W: number, H: number) {
    const axis = frequencyAxis(W, fs, points), Y0 = 8, Y1 = H - 25;
    const sy = (i: number) => Y0 + ((i + 0.5) / rows.length) * (Y1 - Y0);
    return { ...axis, Y0, Y1, sy };
  }

  function grouped(row: Contribution, binOf: (frequency: number) => number, sx: (bin: number) => number) {
    const tones = row.frequencies
      .map((frequency, i) => ({ bin: binOf(frequency), label: row.toneLabels?.[i] ?? '' }))
      .sort((a, b) => a.bin - b.bin);
    const groups: { bins: number[]; labels: string[] }[] = [];
    for (const tone of tones) {
      const last = groups.at(-1), lastBin = last?.bins.at(-1);
      if (!last || lastBin === undefined || sx(tone.bin) - sx(lastBin) >= 28) groups.push({ bins: [tone.bin], labels: tone.label ? [tone.label] : [] });
      else {
        if (!last.bins.includes(tone.bin)) last.bins.push(tone.bin);
        if (tone.label && !last.labels.includes(tone.label)) last.labels.push(tone.label);
      }
    }
    return groups.map((group) => ({ ...group, labelBin: group.bins.reduce((sum, bin) => sum + bin, 0) / group.bins.length, label: group.labels.join('/') }));
  }

  const level = (row: Contribution) => {
    if (!Number.isFinite(row.level)) return row.broadband || row.id === 'harmonics' ? 'off' : 'no spur';
    return row.broadband ? `${nf(-row.level, 1)} dB SNR` : `${nf(row.level, 1)} dBc`;
  };
</script>

<Plot {label}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.ticks as tick, i (tick.bin)}
      <line class="gr" x1={g.sx(tick.bin)} x2={g.sx(tick.bin)} y1={g.Y0} y2={g.Y1} />
      <text class="tx" x={g.sx(tick.bin)} y={height - 5} text-anchor={i === 0 ? 'start' : i === g.ticks.length - 1 ? 'end' : 'middle'}>{freqText(tick.frequency)}</text>
    {/each}
    {#each rows as row, i (row.id)}
      {#if !row.broadband}<line class="lane" x1={g.x0} x2={g.x1} y1={g.sy(i)} y2={g.sy(i)} />{/if}
      <text class="source" x="6" y={g.sy(i) - (g.compact ? 5 : 0)} dominant-baseline="central">{row.label}</text>
      {#if row.formula}
        <text class="note" x={g.compact ? 6 : 93} y={g.sy(i) + (g.compact ? 9 : 0)} dominant-baseline="central">
          {#if row.formula === 'offset'}
            <tspan>k·f</tspan><tspan class="sub" baseline-shift="sub">s</tspan><tspan>/M</tspan>
          {:else if row.formula === 'image'}
            <tspan>k·f</tspan><tspan class="sub" baseline-shift="sub">s</tspan><tspan>/M ± f</tspan><tspan class="sub" baseline-shift="sub">in</tspan>
          {:else}
            <tspan>h·f</tspan><tspan class="sub" baseline-shift="sub">in</tspan>
          {/if}
        </text>
      {/if}
      <text class="level" x={width - 10} y={g.sy(i)} text-anchor="end" dominant-baseline="central">{level(row)}</text>
      {#if !row.broadband}
        {#each grouped(row, g.binOf, g.sx) as group, k (`${row.id}-${k}`)}
          {#each group.bins as bin (bin)}
            <line class="stem {row.id}" x1={g.sx(bin)} x2={g.sx(bin)} y1={g.sy(i) - 8} y2={g.sy(i) + 8} />
            <circle class="tone {row.id}" cx={g.sx(bin)} cy={g.sy(i)} r="3.2" />
          {/each}
          {#if group.label}<text class="tone-label" x={g.sx(group.labelBin)} y={g.sy(i) - 9} text-anchor="middle">{group.label}</text>{/if}
        {/each}
      {/if}
    {/each}
  {/snippet}
</Plot>

<style>
  .lane { stroke: var(--rule); stroke-width: 1.5; }
  .source { fill: var(--ink); font: 500 13px var(--sans); }
  .note { fill: var(--ink-3); font: 400 13px var(--sans); }
  .sub { font-size: 9px; }
  .level { fill: var(--ink-2); font: 12px var(--mono); font-variant-numeric: tabular-nums; }
  .stem { stroke-width: 1.5; }
  .tone { stroke: var(--plot); stroke-width: 1.2; }
  .offset { fill: var(--s2); stroke: var(--s2); }
  .gain { fill: var(--s1); stroke: var(--s1); }
  .skew { fill: var(--brand); stroke: var(--brand); }
  .bandwidth { fill: var(--ink-2); stroke: var(--ink-2); }
  .harmonics { fill: var(--bad); stroke: var(--bad); }
  .tone-label { fill: var(--bad); font: 600 10px var(--mono); }
</style>

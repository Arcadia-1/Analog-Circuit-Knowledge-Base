<script lang="ts">
  import type { Mode } from './model';

  /** One-row PLL block diagram; the fractional parts appear with the divider scheme. */
  let { kind, dtc = false, label }: { kind: Mode; dtc?: boolean; label: string } = $props();
  const frac = $derived(kind !== 'int');
  const BLOCKS = [{ x: 54, t: 'PFD', w: 50 }, { x: 130, t: 'LF', w: 42 }, { x: 198, t: 'VCO', w: 50 }];

  type Arrow = [number, number, number, number];
  function head([x1, y1, x2, y2]: Arrow): { line: Arrow; tri: string } {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 6, w = 3.2;
    const bx = x2 - s * Math.cos(a), by = y2 - s * Math.sin(a);
    const tri = `${x2},${y2} ${bx - w * Math.sin(a)},${by + w * Math.cos(a)} ${bx + w * Math.sin(a)},${by - w * Math.cos(a)}`;
    return { line: [x1, y1, bx, by], tri };
  }
  const arrows = $derived.by((): Arrow[] => {
    const a: Arrow[] = [[28, 16, 54, 16], [104, 16, 130, 16], [172, 16, 198, 16], [248, 16, 330, 16], [282, 16, 282, 40], [79, 52, 79, 28]];
    if (dtc) a.push([244, 52, 200, 52]);
    if (frac) a.push([356, 52, 320, 52], [440, 52, 404, 52]);
    if (dtc) a.push([175, 73, 175, 64]);
    return a;
  });
  const lines = $derived.by((): Arrow[] => {
    const l: Arrow[] = [dtc ? [150, 52, 79, 52] : [244, 52, 79, 52]];
    if (dtc) l.push([380, 64, 380, 73], [380, 73, 175, 73]);
    return l;
  });
</script>

<svg viewBox="0 0 470 78" preserveAspectRatio="xMinYMid meet" role="img" aria-label={label}>
  <text class="m" x="0" y="16">f<tspan font-size="10" dy="4">ref</tspan></text>
  <text class="m" x="336" y="16">f<tspan font-size="10" dy="4">out</tspan></text>
  {#each BLOCKS as { x, t, w } (t)}
    <rect class="box" x={x} y="4" width={w} height="24" rx="4.5" />
    <text class="t" x={x + w / 2} y="16">{t}</text>
  {/each}
  <circle class="dot" cx="282" cy="16" r="2.4" />
  <rect class="box {frac ? 'b2' : 'b1'}" x="244" y="40" width="76" height="24" rx="4.5" />
  <text class="t" x="282" y="52">÷ <tspan class="v">N</tspan>{#if frac} + <tspan class="v">y</tspan>{/if}</text>
  {#if dtc}
    <rect class="box b2" x="150" y="40" width="50" height="24" rx="4.5" />
    <text class="t" x="175" y="52">DTC</text>
    <text class="m small" x="214" y="69">q</text>
  {/if}
  {#if frac}
    <rect class="box b2" x="356" y="40" width="48" height="24" rx="4.5" />
    <text class="t" x="380" y="52">{kind === 'acc' ? 'ACC' : 'ΣΔ'}</text>
    <text class="m small" x="334" y="42">y</text>
    <text class="m" x="446" y="52">α</text>
  {/if}
  {#each lines as l, i (i)}<line class="wire" x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />{/each}
  {#each arrows as a, i (i)}
    {@const h = head(a)}
    <line class="wire" x1={h.line[0]} y1={h.line[1]} x2={h.line[2]} y2={h.line[3]} />
    <polygon class="dot" points={h.tri} />
  {/each}
</svg>

<style>
  svg { display: block; width: 100%; height: auto; aspect-ratio: 470 / 78; max-height: 78px; overflow: visible; }
  .box { fill: var(--plot); stroke: var(--ink-3); stroke-width: 1.25; }
  .b1 { stroke: var(--s1); stroke-width: 1.75; }
  .b2 { stroke: var(--s2); stroke-width: 1.75; }
  .wire { stroke: var(--ink-3); stroke-width: 1.25; fill: none; }
  .dot { fill: var(--ink-3); }
  .t { fill: var(--ink); font: 500 12.5px var(--sans); text-anchor: middle; dominant-baseline: central; }
  .v { font-family: var(--math); font-style: italic; font-weight: 400; font-size: 14.5px; }
  .m { fill: var(--ink-2); font: italic 15px var(--math); dominant-baseline: central; }
  .small { font-size: 13px; }
</style>

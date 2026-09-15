<script lang="ts">
  import Plot from '../../components/chart/Plot.svelte';
  import Tip from '../../components/chart/Tip.svelte';
  import { freqText, nf } from '../../lib/format';
  import { clamp } from '../../lib/scale';
  import type { Analysis } from './model';

  let { an, series, bw, hover, onhover, label }: {
    an: Analysis;
    series: 1 | 2;
    bw: number;
    hover: number | null;
    onhover: (f: number | null) => void;
    label: string;
  } = $props();

  const FMIN = 1e4, YTOP = -20, YBOT = -160, LMIN = Math.log10(FMIN), X0 = 46;
  const TICKS: [number, string][] = [[1e4, '10 kHz'], [1e5, '100 kHz'], [1e6, '1 MHz'], [1e7, '10 MHz']];

  function curveAt(f: number): number {
    const c = an.curve, lf = Math.log10(f);
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1], b = c[i];
      if (f <= b.f) return a.L + ((lf - Math.log10(a.f)) / (Math.log10(b.f) - Math.log10(a.f))) * (b.L - a.L);
    }
    return c[c.length - 1].L;
  }

  function geo(W: number, H: number) {
    const X1 = W - 6, Y0 = 6, Y1 = H - 20, lmax = Math.log10(an.fTop);
    const sx = (f: number) => X0 + ((Math.log10(f) - LMIN) / (lmax - LMIN)) * (X1 - X0);
    const sy = (v: number) => Y0 + ((YTOP - clamp(v, YBOT, YTOP)) / (YTOP - YBOT)) * (Y1 - Y0);
    const every = Y1 - Y0 < 170 ? 40 : 20;
    const grid: number[] = [];
    for (let v = YBOT; v <= YTOP; v += 20) grid.push(v);
    const c = an.curve;
    const line = `M${c.map((p) => `${sx(p.f)},${sy(p.L)}`).join('L')}`;
    const area = `${line}L${sx(c[c.length - 1].f)},${Y1}L${sx(c[0].f)},${Y1}Z`;
    const shown = an.spurs.filter((p) => p.f >= FMIN && p.dBc > YBOT).slice(0, 16);
    // labels: "loop bandwidth" and "dBc/Hz" sit at the top; the largest spur label avoids them
    const hit = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const bwBox: Box = { l: sx(bw) + 4, r: sx(bw) + 96, t: Y0, b: Y0 + 16 };
    const unitBox: Box = { l: X0 + 4, r: X0 + 52, t: Y0, b: Y0 + 16 };
    let showBw = true;
    let spurLabel: { x: number; y: number; anchor: string; text: string } | null = null;
    const top = shown[0];
    if (top) {
      const x = sx(top.f), yt = sy(top.dBc), text = `${nf(top.dBc, 1)} dBc`, w = text.length * 6.6 + 4, ty = yt + (top.dBc > YTOP ? 13 : 4);
      const side = (right: boolean): Box => ({ l: right ? x + 9 : x - 9 - w, r: right ? x + 9 + w : x - 9, t: ty - 11, b: ty + 3 });
      let right = x < X1 - 90, box = side(right);
      if (hit(box, unitBox) || hit(box, bwBox)) {
        const alt = side(!right);
        if (alt.l > X0 && alt.r < X1 && !hit(alt, unitBox) && !hit(alt, bwBox)) { right = !right; box = alt; }
      }
      if (hit(box, bwBox)) showBw = false;
      spurLabel = { x: right ? box.l : box.r, y: ty, anchor: right ? 'start' : 'end', text };
    }
    return { X1, Y0, Y1, sx, sy, every, grid, line, area, shown, showBw, spurLabel, bwBox, unitBox };
  }
  interface Box { l: number; r: number; t: number; b: number }

  function move(x: number, W: number) {
    const X1 = W - 6, lmax = Math.log10(an.fTop);
    onhover(x >= X0 && x <= X1 ? 10 ** (LMIN + ((x - X0) / (X1 - X0)) * (lmax - LMIN)) : null);
  }
</script>

<Plot {label} onpointermove={move} onpointerleave={() => onhover(null)}>
  {#snippet children({ width, height })}
    {@const g = geo(width, height)}
    {#each g.grid as v (v)}
      <line class="gr" x1={X0} y1={g.sy(v)} x2={g.X1} y2={g.sy(v)} />
      {#if (v - YBOT) % g.every === 0}<text class="tx" x="40" y={g.sy(v)} text-anchor="end" dominant-baseline="central">{nf(v, 0)}</text>{/if}
    {/each}
    {#each TICKS.filter(([f]) => f <= an.fTop) as [f, t] (f)}
      <line class="gr" x1={g.sx(f)} y1={g.Y0} x2={g.sx(f)} y2={g.Y1} />
      <text class="tx" x={g.sx(f)} y={height - 5} text-anchor={f === 1e4 ? 'start' : 'middle'}>{t}</text>
    {/each}
    <line class="guide" x1={g.sx(bw)} y1={g.Y0} x2={g.sx(bw)} y2={g.Y1} />
    <path class="a{series}" d={g.area} />
    <path class="c{series}" stroke-width="2" stroke-linejoin="round" d={g.line} />
    {#each g.shown as p (p.f)}
      <line class="c{series}" stroke-width="1.5" x1={g.sx(p.f)} y1={g.sy(curveAt(p.f))} x2={g.sx(p.f)} y2={g.sy(p.dBc)} />
      <circle class="f{series} ring" cx={g.sx(p.f)} cy={g.sy(p.dBc)} r="4.5" />
    {/each}
    {#if g.showBw}<text class="tx2 halo" x={g.bwBox.l + 2} y={g.Y0 + 12}>loop bandwidth</text>{/if}
    <text class="tx2 halo" x={g.unitBox.l + 2} y={g.Y0 + 12}>dBc/Hz</text>
    {#if g.spurLabel}<text class="tx2 tx-ink halo" x={g.spurLabel.x} y={g.spurLabel.y} text-anchor={g.spurLabel.anchor as 'start' | 'end'}>{g.spurLabel.text}</text>{/if}
    {#if hover !== null}<line class="cross" x1={g.sx(hover)} y1={g.Y0} x2={g.sx(hover)} y2={g.Y1} />{/if}
  {/snippet}
  {#snippet overlay({ width, height })}
    {#if hover !== null}
      {@const g = geo(width, height)}
      {@const x = g.sx(hover)}
      {@const near = an.spurs.filter((p) => p.f >= FMIN && Math.abs(g.sx(p.f) - x) < 5).sort((a, b) => b.dBc - a.dBc)[0]}
      {@const L = curveAt(hover)}
      <Tip {x} y={g.sy(near ? near.dBc : L)} {width} text={near ? `${freqText(near.f)} · spur ${nf(near.dBc, 1)} dBc` : `${freqText(hover)} · ${nf(L, 1)} dBc/Hz`} />
    {/if}
  {/snippet}
</Plot>

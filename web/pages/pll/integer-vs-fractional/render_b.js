/* ---------- geometry of each chart, measured in CSS pixels ---------- */
const NS = PLL.N_SHOW;
const geo = {};
function sizeOf(svg) { const W = Math.max(svg.clientWidth, 240), H = Math.max(svg.clientHeight, 120); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); return { W, H }; }
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map((m) => m * p).find((v) => v >= raw); }

/* ---------- phase-detector chart ---------- */
let edgeScaleLast = null;
function ghostOf(sim) {
  let m = 0; for (let i = 0; i < NS; i++) m += sim.qd[i]; m /= NS;
  return Array.from(sim.qd, (v) => (v - m) * 1e12);
}
function edgeScale() {
  let nMin = Infinity, nMax = -Infinity, R = 0;
  for (const s of [res.int.sim, res.frac.sim]) for (let i = 0; i < NS; i++) {
    nMin = Math.min(nMin, s.ndiv[i]); nMax = Math.max(nMax, s.ndiv[i]); R = Math.max(R, Math.abs(s.e[i]) * 1e12);
  }
  if (state.mode === 'dtc') for (const v of ghostOf(res.frac.sim)) R = Math.max(R, Math.abs(v));
  R = Math.max(R * 1.12, 1.08 * res.int.sim.tOut * 1e12);
  return { nMin, nMax, R };
}
function drawEdges(svgId, sim, col, sc0, withGhost) {
  const svg = $(svgId), { W, H } = sizeOf(svg);
  const X0 = 46, X1 = W - 6, Y0 = 44, Y1 = H - 20, cw = (X1 - X0) / NS;
  const R = sc0.R, step = niceStep((2 * R) / Math.max(2, Math.floor((Y1 - Y0) / 24))), top = Math.floor(R / step + 1e-9) * step;
  geo[svgId] = { X0, X1, Y0, Y1, R };
  const xc = (i) => X0 + (i + 0.5) * cw;
  const yN = (n) => (sc0.nMax === sc0.nMin ? 17 : 30 - ((n - sc0.nMin) / (sc0.nMax - sc0.nMin)) * 26);
  const yE = (v) => Y0 + ((R - Math.max(-R, Math.min(R, v))) / (2 * R)) * (Y1 - Y0);
  let s = `<text class="tx" x="40" y="${yN(sc0.nMax)}" text-anchor="end" dominant-baseline="central">÷${sc0.nMax}</text>`;
  if (sc0.nMin !== sc0.nMax) s += `<text class="tx" x="40" y="${yN(sc0.nMin)}" text-anchor="end" dominant-baseline="central">÷${sc0.nMin}</text>`;
  let d = '';
  for (let i = 0; i < NS; i++) { const y = yN(sim.ndiv[i]); d += `${i ? 'L' : 'M'}${X0 + i * cw},${y}L${X0 + (i + 1) * cw},${y}`; }
  s += `<path class="c-${col}" stroke-width="1.75" stroke-linejoin="round" d="${d}"/>`;
  for (let v = -top; v <= top + 1e-6; v += step) {
    const y = yE(v), z = Math.abs(v) < 1e-6;
    s += `<line class="${z ? 'zero' : 'gr'}" x1="${X0}" y1="${y}" x2="${X1}" y2="${y}"/><text class="tx" x="40" y="${y}" text-anchor="end" dominant-baseline="central">${nf(v, 0)}${v >= top - 1e-6 ? ' ps' : ''}</text>`;
  }
  const T = sim.tOut * 1e12;
  if (T < R * 0.98) {
    for (const v of [T, -T]) s += `<line class="guide" x1="${X0}" y1="${yE(v)}" x2="${X1}" y2="${yE(v)}"/>`;
    s += `<text class="tx2 halo" x="${X1}" y="${yE(T) + 14}" text-anchor="end">±1 VCO period</text>`;
  }
  if (withGhost) ghostOf(sim).forEach((v, i) => { s += `<circle class="ghost" cx="${xc(i)}" cy="${yE(v)}" r="2.2"/>`; });
  const y0 = yE(0);
  for (let i = 0; i < NS; i++) {
    const x = xc(i), y = yE(sim.e[i] * 1e12);
    s += `<line class="c-${col}" stroke-width="2" stroke-linecap="round" x1="${x}" y1="${y0}" x2="${x}" y2="${y}"/><circle class="f-${col}" cx="${x}" cy="${y}" r="2.6"/>`;
  }
  for (const c of (X1 - X0) < 420 ? [0, 40, 80] : [0, 20, 40, 60, 80]) s += `<text class="tx" x="${X0 + c * cw}" y="${H - 5}" text-anchor="${c === 80 ? 'end' : 'middle'}">${c}${c === 80 ? ' cycles' : ''}</text>`;
  s += `<g id="${svgId}-hov"></g>`;
  svg.innerHTML = s;
}

/* ---------- spectrum chart ---------- */
const FMIN = 1e4, YTOP = -20, YBOT = -160, LMIN = Math.log10(FMIN);
function curveAt(curve, f) {
  const lf = Math.log10(f);
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    if (f <= b.f) { const t = (lf - Math.log10(a.f)) / (Math.log10(b.f) - Math.log10(a.f)); return a.L + t * (b.L - a.L); }
  }
  return curve[curve.length - 1].L;
}
function specMap(svgId) {
  const g = geo[svgId];
  return { sx: (f) => g.X0 + ((Math.log10(f) - LMIN) / (g.lmax - LMIN)) * (g.X1 - g.X0), sy: (v) => g.Y0 + ((YTOP - Math.min(YTOP, Math.max(YBOT, v))) / (YTOP - YBOT)) * (g.Y1 - g.Y0) };
}
function drawSpectrum(svgId, an, col) {
  const svg = $(svgId), { W, H } = sizeOf(svg);
  geo[svgId] = { X0: 46, X1: W - 6, Y0: 6, Y1: H - 20, lmax: Math.log10(an.fTop) };
  const { sx, sy } = specMap(svgId), g = geo[svgId], every = (g.Y1 - g.Y0) < 170 ? 40 : 20;
  let s = '';
  for (let v = YBOT; v <= YTOP; v += 20) {
    s += `<line class="gr" x1="${g.X0}" y1="${sy(v)}" x2="${g.X1}" y2="${sy(v)}"/>`;
    if ((v - YBOT) % every === 0) s += `<text class="tx" x="40" y="${sy(v)}" text-anchor="end" dominant-baseline="central">${nf(v, 0)}</text>`;
  }
  for (const [f, t] of [[1e4, '10 kHz'], [1e5, '100 kHz'], [1e6, '1 MHz'], [1e7, '10 MHz']].filter(([f]) => f <= an.fTop)) {
    s += `<line class="gr" x1="${sx(f)}" y1="${g.Y0}" x2="${sx(f)}" y2="${g.Y1}"/><text class="tx" x="${sx(f)}" y="${H - 5}" text-anchor="${f === 1e4 ? 'start' : 'middle'}">${t}</text>`;
  }
  s += `<line class="guide" x1="${sx(state.bw)}" y1="${g.Y0}" x2="${sx(state.bw)}" y2="${g.Y1}"/>`;
  const boxes = { bw: { l: sx(state.bw) + 4, r: sx(state.bw) + 96, t: g.Y0, b: g.Y0 + 16 }, unit: { l: g.X0 + 4, r: g.X0 + 52, t: g.Y0, b: g.Y0 + 16 } };
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  let showBw = true, spurLabel = '';
  const pts = an.curve.map((p) => [sx(p.f), sy(p.L)]);
  s += `<path class="a-${col}" d="M${pts[0][0]},${g.Y1}L${pts.map((p) => p.join(',')).join('L')}L${pts[pts.length - 1][0]},${g.Y1}Z"/>`;
  s += `<path class="c-${col}" stroke-width="2" stroke-linejoin="round" d="M${pts.map((p) => p.join(',')).join('L')}"/>`;
  an.spurs.filter((p) => p.f >= FMIN && p.dBc > YBOT).slice(0, 16).forEach((p, i) => {
    const x = sx(p.f), yb = sy(curveAt(an.curve, p.f)), yt = sy(p.dBc);
    s += `<line class="c-${col}" stroke-width="1.5" x1="${x}" y1="${yb}" x2="${x}" y2="${yt}"/><circle class="f-${col} ring" cx="${x}" cy="${yt}" r="4.5"/>`;
    if (i === 0) {
      const text = `${nf(p.dBc, 1)} dBc`, w = text.length * 6.6 + 4, ty = yt + (p.dBc > YTOP ? 13 : 4);
      const side = (right) => ({ l: right ? x + 9 : x - 9 - w, r: right ? x + 9 + w : x - 9, t: ty - 11, b: ty + 3 });
      let right = x < g.X1 - 90, bx = side(right);
      if (hit(bx, boxes.unit) || hit(bx, boxes.bw)) { const alt = side(!right); if (alt.l > g.X0 && alt.r < g.X1 && !hit(alt, boxes.unit) && !hit(alt, boxes.bw)) { right = !right; bx = alt; } }
      if (hit(bx, boxes.bw)) showBw = false;
      spurLabel = `<text class="tx2 tx-ink halo" x="${right ? bx.l : bx.r}" y="${ty}" text-anchor="${right ? 'start' : 'end'}">${text}</text>`;
    }
  });
  if (showBw) s += `<text class="tx2 halo" x="${boxes.bw.l + 2}" y="${g.Y0 + 12}">loop bandwidth</text>`;
  s += `<text class="tx2 halo" x="${boxes.unit.l + 2}" y="${g.Y0 + 12}">dBc/Hz</text>` + spurLabel;
  s += `<g id="${svgId}-hov"></g>`;
  svg.innerHTML = s;
}

/* ---------- results in the captions ---------- */
function drawStats(id, an) {
  const sp = an.spurs.find((p) => p.f >= FMIN);
  const jit = an.jitterFs >= 1e3 ? `${nf(an.jitterFs / 1e3, an.jitterFs >= 1e4 ? 1 : 2)} ps` : `${nf(an.jitterFs, 0)} fs`;
  $(id).innerHTML = `RMS jitter <b>${jit}</b> <span class="band">(${freqText(an.bandLo)}–${freqText(an.bandHi)})</span> · largest spur ${sp ? `<b>${nf(sp.dBc, 1)} dBc</b> at ${freqText(sp.f)}` : '<b>none</b>'}`;
}

/* ---------- synchronized hover ---------- */
const hov = { edge: null, spec: null };
function tipIn(boxId) {
  const box = $(boxId); let t = box.querySelector('.tip');
  if (!t) { t = document.createElement('div'); t.className = 'tip'; t.hidden = true; box.appendChild(t); }
  return t;
}
function placeTip(boxId, x, y, html) {
  const box = $(boxId), t = tipIn(boxId); t.innerHTML = html; t.hidden = false;
  const half = t.offsetWidth / 2 + 2;
  t.style.left = `${Math.min(box.clientWidth - half, Math.max(half, x))}px`; t.style.top = `${Math.max(t.offsetHeight + 2, y - 8)}px`;
}
function drawEdgeHover() {
  for (const col of ['int', 'frac']) {
    const id = `edge-${col}`, g = $(`${id}-hov`), box = `${id}-box`, G = geo[id];
    if (!g || !G) continue;
    if (hov.edge == null) { g.innerHTML = ''; tipIn(box).hidden = true; continue; }
    const sim = res[col].sim, i = hov.edge, x = G.X0 + (i + 0.5) * (G.X1 - G.X0) / NS;
    const y = G.Y0 + ((G.R - Math.max(-G.R, Math.min(G.R, sim.e[i] * 1e12))) / (2 * G.R)) * (G.Y1 - G.Y0);
    g.innerHTML = `<line class="cross" x1="${x}" y1="4" x2="${x}" y2="${G.Y1}"/>`;
    placeTip(box, x, Math.min(y, G.Y0 + 24), `cycle ${i} · ÷${sim.ndiv[i]} · ${nf(sim.e[i] * 1e12, 1)} ps`);
  }
}
function drawSpecHover() {
  for (const col of ['int', 'frac']) {
    const id = `spec-${col}`, g = $(`${id}-hov`), box = `${id}-box`, G = geo[id];
    if (!g || !G) continue;
    if (hov.spec == null) { g.innerHTML = ''; tipIn(box).hidden = true; continue; }
    const { sx, sy } = specMap(id), an = res[col].an, f = hov.spec, x = sx(f);
    const near = an.spurs.filter((p) => p.f >= FMIN && Math.abs(sx(p.f) - x) < 5).sort((a, b) => b.dBc - a.dBc)[0];
    const L = curveAt(an.curve, f), y = sy(near ? near.dBc : L);
    g.innerHTML = `<line class="cross" x1="${x}" y1="${G.Y0}" x2="${x}" y2="${G.Y1}"/><circle class="f-${col} ring" cx="${near ? sx(near.f) : x}" cy="${y}" r="3.5"/>`;
    placeTip(box, x, y, near ? `${freqText(near.f)} · spur ${nf(near.dBc, 1)} dBc` : `${freqText(f)} · ${nf(L, 1)} dBc/Hz`);
  }
}
function localX(svg, ev) { return ev.clientX - svg.getBoundingClientRect().left; }
for (const col of ['int', 'frac']) {
  const e = $(`edge-${col}`), sp = $(`spec-${col}`);
  e.addEventListener('pointermove', (ev) => { const G = geo[e.id]; if (!G) return; const i = Math.floor((localX(e, ev) - G.X0) / ((G.X1 - G.X0) / NS)); hov.edge = i >= 0 && i < NS ? i : null; drawEdgeHover(); });
  e.addEventListener('pointerleave', () => { hov.edge = null; drawEdgeHover(); });
  sp.addEventListener('pointermove', (ev) => { const G = geo[sp.id]; if (!G) return; const x = localX(sp, ev); hov.spec = x >= G.X0 && x <= G.X1 ? Math.pow(10, LMIN + ((x - G.X0) / (G.X1 - G.X0)) * (G.lmax - LMIN)) : null; drawSpecHover(); });
  sp.addEventListener('pointerleave', () => { hov.spec = null; drawSpecHover(); });
}

/* ---------- compute, draw, wire up ---------- */
let intCache = { n: null };
function compute() {
  const key = `${Math.round(state.target / state.fRef)}@${state.fRef}@${state.bw}`;
  if (intCache.n !== key) { const sim = PLL.simulate(state.target, 'int', 0, state.fRef, state.bw); intCache = { n: key, sim, an: PLL.analyze(sim) }; }
  res.int = intCache;
  const sim = PLL.simulate(state.target, state.mode, state.inl, state.fRef, state.bw);
  res.frac = { sim, an: PLL.analyze(sim) };
}
function draw() {
  drawRuler(); drawReadouts();
  drawDiagram('diag-int', 'int'); drawDiagram('diag-frac', state.mode);
  edgeScaleLast = edgeScale();
  drawEdges('edge-int', res.int.sim, 'int', edgeScaleLast, false);
  drawEdges('edge-frac', res.frac.sim, 'frac', edgeScaleLast, state.mode === 'dtc');
  $('cap-edge-frac').innerHTML = state.mode === 'dtc' ? '<span class="gk"></span>divider edge<span class="gk frac"></span>after DTC' : '';
  drawSpectrum('spec-int', res.int.an, 'int'); drawSpectrum('spec-frac', res.frac.an, 'frac');
  drawStats('stats-int', res.int.an); drawStats('stats-frac', res.frac.an);
  drawEdgeHover(); drawSpecHover();
}
let rafId = 0, needCompute = true;
const schedule = (recompute = true) => { needCompute = needCompute || recompute; if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; if (needCompute) { compute(); needCompute = false; } draw(); }); };
function setTarget(gHz) {
  const v = Math.min(T_HI, Math.max(T_LO, gHz));
  state.target = Math.round(v * 1e4) * 1e5;
  $('target').value = (state.target / 1e9).toFixed(4); $('target-num').value = (state.target / 1e9).toFixed(4);
  fitTarget(); schedule();
}
const measureCtx = document.createElement('canvas').getContext('2d');
function fitTarget() {
  const el = $('target-num'), cs = getComputedStyle(el);
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  el.style.width = `${Math.ceil(measureCtx.measureText(el.value || '0').width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)) + 2}px`;
}
$('target').addEventListener('input', (e) => setTarget(parseFloat(e.target.value)));
const commitTarget = () => { const v = parseFloat($('target-num').value.replace(',', '.')); setTarget(Number.isFinite(v) ? v : state.target / 1e9); };
$('target-num').addEventListener('change', commitTarget);
$('target-num').addEventListener('input', fitTarget);
$('target-num').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { commitTarget(); e.target.blur(); }
  else if (e.key === 'Escape') { e.target.value = (state.target / 1e9).toFixed(4); fitTarget(); e.target.blur(); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setTarget(state.target / 1e9 + (e.shiftKey ? 1e-3 : 1e-4) * (e.key === 'ArrowUp' ? 1 : -1)); }
});
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitTarget(); schedule(false); });
const BW_STEPS = [100e3, 120e3, 150e3, 200e3, 250e3, 300e3, 400e3, 500e3, 600e3, 800e3, 1e6, 1.2e6, 1.5e6, 2e6, 2.5e6, 3e6, 4e6, 5e6];
const bwSteps = () => BW_STEPS.filter((v) => v <= PLL.bwMaxFor(state.fRef) * (1 + 1e-9));
function syncBw() {
  const steps = bwSteps(), el = $('bw');
  if (state.bw > steps[steps.length - 1]) state.bw = steps[steps.length - 1];
  el.max = String(steps.length - 1);
  el.value = String(steps.indexOf(state.bw) >= 0 ? steps.indexOf(state.bw) : steps.length - 1);
  $('bw-out').textContent = freqText(state.bw);
  el.setAttribute('aria-valuetext', freqText(state.bw));
}
$('bw').addEventListener('input', (e) => {
  const steps = bwSteps();
  state.bw = steps[Math.min(steps.length - 1, Math.max(0, parseInt(e.target.value, 10)))];
  syncBw();
  schedule();
});
document.querySelectorAll('#ref-seg button').forEach((b) => b.addEventListener('click', () => {
  state.fRef = parseFloat(b.dataset.ref) * 1e6;
  syncBw();
  document.querySelectorAll('#ref-seg button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  schedule();
}));
document.querySelectorAll('#mode-seg button').forEach((b) => b.addEventListener('click', () => {
  state.mode = b.dataset.mode;
  document.querySelectorAll('#mode-seg button').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
  $('inl-wrap').hidden = state.mode !== 'dtc';
  schedule();
}));
$('inl').addEventListener('input', (e) => { state.inl = parseFloat(e.target.value); $('inl-out').textContent = `${state.inl.toFixed(1)} ps`; schedule(); });
new ResizeObserver(() => { if (res.int) schedule(false); }).observe(document.querySelector('.page'));
fitTarget(); syncBw();
compute(); needCompute = false; draw();   // first frame renders synchronously, not on a paint callback

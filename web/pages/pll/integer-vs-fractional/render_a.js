/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const RL_LO = 4.94e9, RL_HI = 5.16e9, T_LO = 4.95, T_HI = 5.149;
const state = { target: 5.005e9, mode: 'acc', inl: 0, fRef: 40e6, bw: 1e6 };
const res = { int: null, frac: null };
const nf = (v, d) => v.toFixed(d).replace('-', '−');
function freqText(f) {
  const a = Math.abs(f);
  const trim = (v) => v.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  if (a >= 1e6) return `${trim((a / 1e6).toFixed(a >= 1e7 ? 1 : 2))} MHz`;
  if (a >= 1e3) return `${trim((a / 1e3).toFixed(a >= 1e5 ? 0 : 1))} kHz`;
  return `${a.toFixed(0)} Hz`;
}
function arrow(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, w = 3.2;
  const bx = x2 - s * Math.cos(a), by = y2 - s * Math.sin(a);
  const p = [[x2, y2], [bx - w * Math.sin(a), by + w * Math.cos(a)], [bx + w * Math.sin(a), by - w * Math.cos(a)]];
  return `<line class="dg-line" x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}"/><polygon class="dg-head" points="${p.map((q) => q.join(',')).join(' ')}"/>`;
}
const poly = (pts) => pts.map((p) => p.join(',')).join(' ');

/* ---------- frequency ruler ---------- */
function drawRuler() {
  const svg = $('ruler'), W = Math.max(svg.clientWidth, 200), H = 64;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const X = (f) => ((f - RL_LO) / (RL_HI - RL_LO)) * W, fr = state.fRef;
  const fInt = Math.round(state.target / fr) * fr, xt = X(state.target), xi = X(fInt);
  let s = `<line class="rl-base" x1="0" y1="28" x2="${W}" y2="28"/>`;
  for (let mhz = 4940; mhz <= 5160; mhz += 10) {
    const x = X(mhz * 1e6), major = mhz % 50 === 0;
    s += `<line class="rl-minor" x1="${x}" y1="${major ? 21 : 24}" x2="${x}" y2="28"/>`;
    if (major) s += `<text class="tx" x="${x}" y="10" text-anchor="${x < 18 ? 'start' : x > W - 18 ? 'end' : 'middle'}">${(mhz / 1000).toFixed(2)}</text>`;
  }
  for (let n = Math.ceil(RL_LO / fr - 1e-9); n * fr <= RL_HI + 1; n++) {
    const x = X(n * fr);
    s += `<line class="rl-chan" x1="${x}" y1="17" x2="${x}" y2="38"/><circle class="rl-slot" cx="${x}" cy="48" r="3.5"/>`;
  }
  s += `<line class="rl-lane" x1="0" y1="59" x2="${W}" y2="59"/>`;
  s += `<line class="rl-miss" x1="${xt}" y1="48" x2="${xi}" y2="48"/><circle class="f-int ring" cx="${xi}" cy="48" r="5"/>`;
  s += `<circle class="f-frac ring" cx="${xt}" cy="59" r="5"/>`;
  s += `<line class="rl-handle" x1="${xt}" y1="15" x2="${xt}" y2="41"/><circle class="rl-knob" cx="${xt}" cy="28" r="6.5"/>`;
  svg.innerHTML = s;
}

/* ---------- readouts ---------- */
function drawReadouts() {
  const ri = res.int.sim, rf = res.frac.sim, miss = ri.fOut - state.target;
  const missText = Math.abs(miss) < 50 ? '<span class="chip">on target</span>'
    : `<span class="chip miss">misses target by ${freqText(miss)}</span>`;
  $('read-int').innerHTML = `<span><var>N</var> = <span class="mono">${ri.nInt}</span></span><span class="mono">${(ri.fOut / 1e9).toFixed(4)} GHz</span>${missText}`;
  $('read-frac').innerHTML = `<span><var>N</var> + <var>α</var> = <span class="mono">${rf.nAvg.toFixed(4)}</span></span><span class="mono">${(rf.fOut / 1e9).toFixed(4)} GHz</span><span class="chip">on target</span>`;
  $('legend-int').textContent = `${state.fRef / 1e6} MHz`;
}

/* ---------- block diagrams (one compact row) ---------- */
function box(x, y, w, h, label, cls = '') {
  return `<rect class="dg-box ${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4.5"/><text class="dg-t" x="${x + w / 2}" y="${y + h / 2}">${label}</text>`;
}
function drawDiagram(svgId, kind) {
  const frac = kind !== 'int', col = frac ? 'frac' : 'int';
  let s = `<text class="dg-m" x="0" y="16">f<tspan font-size="10" dy="4">ref</tspan></text>` + arrow(28, 16, 54, 16);
  s += box(54, 4, 50, 24, 'PFD') + arrow(104, 16, 130, 16);
  s += box(130, 4, 42, 24, 'LF') + arrow(172, 16, 198, 16);
  s += box(198, 4, 50, 24, 'VCO') + arrow(248, 16, 330, 16);
  s += `<text class="dg-m" x="336" y="16">f<tspan font-size="10" dy="4">out</tspan></text>`;
  s += `<circle class="dg-head" cx="282" cy="16" r="2.4"/>` + arrow(282, 16, 282, 40);
  s += box(244, 40, 76, 24, frac ? '÷ <tspan class="dg-v">N</tspan> + <tspan class="dg-v">y</tspan>' : '÷ <tspan class="dg-v">N</tspan>', col);
  if (kind === 'dtc') {
    s += arrow(244, 52, 200, 52) + box(150, 40, 50, 24, 'DTC', 'frac');
    s += `<line class="dg-line" x1="150" y1="52" x2="79" y2="52"/>` + arrow(79, 52, 79, 28);
  } else {
    s += `<line class="dg-line" x1="244" y1="52" x2="79" y2="52"/>` + arrow(79, 52, 79, 28);
  }
  if (frac) {
    s += box(356, 40, 48, 24, kind === 'acc' ? 'ACC' : 'ΣΔ', 'frac') + arrow(356, 52, 320, 52);
    s += `<text class="dg-m" x="334" y="42" font-size="13">y</text>` + arrow(440, 52, 404, 52) + `<text class="dg-m" x="446" y="52">α</text>`;
    if (kind === 'dtc') s += `<line class="dg-line" x1="380" y1="64" x2="380" y2="73"/><line class="dg-line" x1="380" y1="73" x2="175" y2="73"/>` + arrow(175, 73, 175, 64) + `<text class="dg-m" x="214" y="69" font-size="13">q</text>`;
  }
  const svg = $(svgId);
  svg.setAttribute('viewBox', '0 0 470 78');
  svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
  svg.innerHTML = s;
}

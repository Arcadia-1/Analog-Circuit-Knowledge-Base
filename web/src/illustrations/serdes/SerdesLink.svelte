<script lang="ts">
  import { onMount } from 'svelte';
  import Notes from '../../components/ui/Notes.svelte';
  import Range from '../../components/ui/Range.svelte';
  import Segmented from '../../components/ui/Segmented.svelte';
  import { nf } from '../../lib/format';
  import { BLOCKS, CATEGORY, ERROR_COLOR, SYMBOL_COLORS, type BlockId } from './blocks';
  import { analyzeLink, lineResponses, type LinkAnalysis, type LinkSettings, type Metrics } from './model';
  import Scope from './Scope.svelte';
  import type { SerdesScene, ViewName } from './scene';
  import { EyeStream, Receiver, SymbolStream } from './streams';

  /** Slow motion: 8 UI of 17.86 ps each play per second at 1×. */
  const UIPS = 8, START = 480;
  const VIEWS: { value: ViewName; label: string }[] = [
    { value: 'overview', label: 'Overview' }, { value: 'tx', label: 'TX chip' }, { value: 'channel', label: 'Channel' }, { value: 'rx', label: 'RX chip' }, { value: 'adc', label: 'TI-ADC' },
  ];
  const LEVEL_NAMES = ['−3', '−1', '+1', '+3'];

  let lossDb = $state(28), xtMv = $state(1.5), rxnMv = $state(0.8), txFfe = $state(true), dsp = $state(true);
  let ctle = $state<'auto' | 'manual'>('auto'), gdc = $state(-9), gdc2 = $state(-3);
  let playing = $state(true), speed = $state(1), labels = $state(true), spin = $state(true);
  let view = $state<ViewName | null>('overview');
  let light = $state(false), noGl = $state(false);
  let hover = $state<{ id: BlockId; x: number; y: number } | null>(null);
  let picked = $state<BlockId | null>(null);
  let host: HTMLDivElement | undefined = $state();
  let scope: ReturnType<typeof Scope> | undefined = $state();

  const first = analyzeLink({ lossDb: 28, xtV: 1.5e-3, rxNoiseV: 0.8e-3, txFfe: true, autoCtle: true, gdc: -9, gdc2: -3, dsp: true });
  let a = $state.raw<LinkAnalysis>(first);
  const rx = new Receiver(first, true), stream = new SymbolStream(), eyes = new EyeStream();
  let live = $state.raw<Metrics>(rx.live);
  let adapting = $state(false), decisions = $state(0), errors = $state(0);
  let line = lineResponses(28, true), lineKey = '28|true';
  let scene: SerdesScene | null = null;

  // Re-solve the link shortly after the settings stop moving; the running taps then adapt toward the new optimum.
  $effect(() => {
    const auto = ctle === 'auto';
    const s: LinkSettings = { lossDb, xtV: xtMv * 1e-3, rxNoiseV: rxnMv * 1e-3, txFfe, dsp, autoCtle: auto, gdc: auto ? 0 : gdc, gdc2: auto ? 0 : gdc2 };
    const timer = setTimeout(() => {
      a = analyzeLink(s);
      rx.retarget(a, s.dsp);
      if (auto) {
        gdc = a.gdc;
        gdc2 = a.gdc2;
      }
      const key = `${s.lossDb}|${s.txFfe}`;
      if (key !== lineKey) {
        lineKey = key;
        line = lineResponses(s.lossDb, s.txFfe);
      }
      scene?.setPadLoss(s.lossDb);
    }, 90);
    return () => clearTimeout(timer);
  });

  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      playing = false;
      spin = false;
    }
    const isLight = () => document.documentElement.classList.contains('light');
    light = isLight();
    const themeWatch = new MutationObserver(() => {
      light = isLight();
      scene?.setTheme(light);
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    let t = START, clockT = 0, frame = 0, raf = 0, last = performance.now(), gone = false;
    stream.start(t, rx);
    eyes.run(1500, rx);
    import('./scene').then(({ SerdesScene }) => {
      if (gone || !host) return;
      try {
        scene = new SerdesScene(host, {
          reducedMotion: reduced,
          onHover: (id, x, y) => {
            const r = host?.getBoundingClientRect();
            hover = id && r ? { id, x: x - r.left, y: y - r.top } : null;
          },
          onPick: (id) => (picked = id === 'pcb' ? null : id),
          onUserMove: () => {
            view = null;
            spin = false;
            scene?.setSpin(false);
          },
        });
      } catch {
        noGl = true;
        return;
      }
      scene.setTheme(light);
      scene.setLabels(labels);
      scene.setSpin(spin);
      scene.setPadLoss(lossDb);
    });
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frame++;
      if (playing) {
        t += dt * UIPS * speed;
        clockT += dt;
      }
      const moving = rx.adapt(dt);
      stream.advance(t, rx, (n, v) => scene?.sampled(n, v, rx.tSample));
      scene?.update(dt, t, clockT, rx, stream, line, txFfe);
      if (scope?.showsEyes()) {
        const k = Math.pow(0.955, dt * 60);
        for (const e of eyes.eyes) e.decay(k);
        eyes.run(Math.max(8, Math.round(44 * dt * 60)), rx);
        scope.draw();
      }
      if (frame % 8 === 0) {
        live = rx.live;
        adapting = moving;
        decisions = stream.decisions;
        errors = stream.errors;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      gone = true;
      cancelAnimationFrame(raf);
      themeWatch.disconnect();
      scene?.dispose();
      scene = null;
    };
  });

  const go = (v: ViewName) => {
    view = v;
    scene?.flyTo(v);
  };
  const slowMs = $derived(1000 / (UIPS * speed));
  const facts = $derived.by((): [string, string][] => {
    switch (picked) {
      case 'ctle': return [['g_DC / g_DC2', `${nf(a.gdc, 0)} / ${nf(a.gdc2, 0)} dB`], ['Boost, 28 GHz vs DC', `${nf(a.ctleBoostDb, 1)} dB`], ['Setting', ctle === 'auto' ? 'auto, best SNR' : 'manual']];
      case 'vga': return [['Gain', `${nf(20 * Math.log10(a.vga), 1)} dB`]];
      case 'dsp': return [['SNR at slicer', `${nf(10 * Math.log10(live.snr), 1)} dB`], ['DFE b₁', dsp ? nf(live.b1, 3) : 'off']];
      case 'cdr': return [['Sampling phase', `${nf(a.phaseUi, 2)} UI from the pulse peak`]];
      case 'chan': return [['Loss at 28 GHz', `${lossDb} dB bump to bump`], ['Velocity', '≈ 0.5 c, 2.7 mm per UI']];
      case 'txdsp': return [['Taps', txFfe ? '−0.10 / 0.75 / −0.15' : '0 / 1 / 0 (off)']];
      case 'deser': return [['Decisions', decisions.toLocaleString('en-US')], ['Errors seen', String(errors)]];
      default: return [];
    }
  });
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') picked = null; }} />

<main class="page serdes">
  <header class="top">
    <div class="controls">
      <Range id="serdes-loss" bind:value={lossDb} min={8} max={44} step={1} output={`${lossDb} dB`}>Loss at 28 GHz</Range>
      <Range id="serdes-xt" bind:value={xtMv} min={0} max={4} step={0.1} output={`${xtMv.toFixed(1)} mV`}>Crosstalk</Range>
      <Range id="serdes-rxn" bind:value={rxnMv} min={0.2} max={2.5} step={0.1} output={`${rxnMv.toFixed(1)} mV`}>RX noise</Range>
      <div class="pick"><span class="label">TX FFE</span><Segmented size="sm" label="Transmitter feed-forward equalizer" options={[{ value: false, label: 'Off' }, { value: true, label: '3-tap' }]} bind:value={txFfe} /></div>
      <div class="pick"><span class="label">CTLE</span><Segmented size="sm" label="CTLE setting" options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]} bind:value={ctle} /></div>
      {#if ctle === 'manual'}<Range id="serdes-gdc" bind:value={gdc} min={-20} max={0} step={1} output={`${nf(gdc, 0)} dB`}>g<sub>DC</sub></Range>{/if}
      <div class="pick"><span class="label">DSP</span><Segmented size="sm" label="Receiver DSP equalizer" options={[{ value: false, label: 'Off' }, { value: true, label: 'FFE + DFE' }]} bind:value={dsp} /></div>
    </div>
    <Notes>
      <p><b>What moves.</b> Symbols from a PRBS13Q source speed up through the transmitter's MUX tree, leave through an SST driver whose segments light with each PAM4 level, and travel along the board as the drawn line voltage. At the receiver each of 64 SAR ADC tiles flashes as it samples, the FFE and DFE taps stand as pillars, and decided symbols fan out through the DEMUX tree; red ones are errors. The animation runs about 7×10⁹ times slower than the real link and is not to scale: a 30 cm trace holds about 110 symbols, 44 are drawn.</p>
      <p><b>Channel.</b> The bump-to-bump loss at 28 GHz is split 35 % skin effect, exp(−a√(jf)), and 65 % dielectric, exp(−b(jf)<sup>0.9</sup>); both forms are causal. One echo (ρ₁ρ₂ = 0.02, 9 UI) stands for the package transitions. The TX driver has two poles at 50 GHz and the RX front end one at 45 GHz.</p>
      <p><b>Receiver.</b> The CTLE uses the IEEE 802.3ck COM reference form (zero at f<sub>b</sub>/2.5, poles at f<sub>b</sub>/2.5 and f<sub>b</sub>, shelf at f<sub>b</sub>/80). Auto searches g<sub>DC</sub> from 0 to −20 dB and g<sub>DC2</sub> in {'{'}0, −3, −6{'}'} dB together with the sampling phase for the best SNR. A VGA sets the rms to 0.3 of full scale; the 12-tap FFE and 1-tap DFE are the MMSE solution, which the running taps approach after every change.</p>
      <p><b>Noise and BER.</b> RX noise is white at the pad over 0–28 GHz and crosstalk band-pass, both shaped by the CTLE; the ADC adds 0.010 FS rms (about 6 ENOB), the TX has 28 dB SNDR and random jitter is 0.2 ps rms. BER uses the Gaussian approximation (3/4)·Q(√(SNR/5)), which is pessimistic when bounded ISI dominates. KP4 FEC corrects a pre-FEC BER up to about 2.4×10⁻⁴.</p>
      <p><b>Verification.</b> The model is a TypeScript port of <code>python/serdes_112g_link.py</code>; the tests compare it with the NumPy reference and check that the loss at 28 GHz is exact, the pulse response is causal with unit area, and no single-tap change improves on the MMSE solution.</p>
    </Notes>
  </header>

  <section class="work">
    <div class="stage" bind:this={host}>
      {#if noGl}<p class="nogl">This view needs WebGL, which is turned off or unavailable in this browser.</p>{/if}
      <div class="bar views" role="group" aria-label="Camera views">
        {#each VIEWS as v (v.value)}<button type="button" aria-pressed={view === v.value} onclick={() => go(v.value)}>{v.label}</button>{/each}
      </div>
      <div class="bar play">
        <button type="button" class="primary" aria-pressed={playing} onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
        <Segmented size="sm" mono label="Playback speed" options={[{ value: 0.25, label: '¼×' }, { value: 0.5, label: '½×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 4, label: '4×' }]} bind:value={speed} />
        <button type="button" aria-pressed={spin} onclick={() => { spin = !spin; scene?.setSpin(spin); }}>Rotate</button>
        <button type="button" aria-pressed={labels} onclick={() => { labels = !labels; scene?.setLabels(labels); }}>Labels</button>
        <span class="slow">1 UI = 17.86 ps, shown as {nf(slowMs, slowMs < 100 ? 1 : 0)} ms</span>
      </div>
      <ul class="bar key" aria-label="Symbol colours">
        {#each SYMBOL_COLORS as c, i (c)}<li><i style:background={c}></i>{LEVEL_NAMES[i]}</li>{/each}
        <li><i style:background={ERROR_COLOR}></i>error</li>
      </ul>
      {#if hover && !picked}
        <div class="tip" style:left="{hover.x + 14}px" style:top="{hover.y + 16}px">{BLOCKS[hover.id].title}<small>Click for details</small></div>
      {/if}
      {#if picked}
        {@const info = BLOCKS[picked]}
        <article class="info" aria-live="polite">
          <div class="info-head">
            <div>
              <span class="cat"><i style:background="#{CATEGORY[info.category].color.toString(16).padStart(6, '0')}"></i>{CATEGORY[info.category].name}</span>
              <h2>{info.title}</h2>
            </div>
            <button type="button" onclick={() => (picked = null)}>Close</button>
          </div>
          <p>{info.text}</p>
          {#if facts.length}<dl>{#each facts as [k, v] (k)}<dt>{k}</dt><dd class="mono">{v}</dd>{/each}</dl>{/if}
          {#if picked !== 'pcb'}<button type="button" class="primary" onclick={() => { if (picked) scene?.focus(picked); view = null; }}>Fly to block</button>{/if}
        </article>
      {/if}
    </div>
    <Scope bind:this={scope} {a} {live} {dsp} {adapting} {decisions} {errors} {light} {eyes} />
  </section>
</main>

<style>
  .serdes { grid-template-rows: auto minmax(0, 1fr); }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 22px; --range-width: 104px; --range-output-width: 6.5ch; --accent: var(--brand); --accent-soft: var(--brand-soft); }
  .pick { display: flex; align-items: center; gap: 8px; }
  .top :global(.notes) { margin-left: auto; }
  .work { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; min-height: 0; border-top: 1px solid var(--rule); padding-top: 12px; }
  .stage { position: relative; min-height: 0; overflow: hidden; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--rule); background: var(--plot); }
  .stage :global(.serdes-canvas) { position: absolute; inset: 0; display: block; touch-action: none; }
  .stage :global(.serdes-labels) { position: absolute; inset: 0; pointer-events: none; }
  .stage :global(.serdes-lbl) { position: relative; top: -17px; display: flex; align-items: center; gap: 5px; padding: 3px 7px 3px 6px; border-radius: 5px; background: color-mix(in srgb, var(--plot) 88%, transparent); box-shadow: 0 0 0 1px var(--rule), 0 2px 8px rgba(0, 0, 0, 0.14); color: var(--ink); font: 500 11.5px/1.2 var(--sans); white-space: nowrap; transition: opacity 0.3s; }
  .stage :global(.serdes-lbl::after) { content: ''; position: absolute; left: 50%; top: 100%; width: 1px; height: 12px; background: var(--ink-3); opacity: 0.6; }
  .stage :global(.serdes-lbl i) { width: 7px; height: 7px; border-radius: 2px; background: var(--ink-3); }
  .stage :global(.serdes-lbl.big) { font-size: 13px; font-weight: 600; }
  .stage :global(.far .serdes-lbl) { opacity: 0; }
  .nogl { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 20px; color: var(--ink-2); text-align: center; }
  .bar { position: absolute; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .views { top: 10px; left: 10px; padding: 3px; border-radius: 8px; background: color-mix(in srgb, var(--plot) 86%, transparent); box-shadow: inset 0 0 0 1px var(--rule); }
  .play { left: 10px; bottom: 10px; right: 200px; gap: 8px; }
  .key { right: 12px; bottom: 14px; width: max-content; flex-wrap: nowrap; gap: 10px; margin: 0; padding: 0; list-style: none; font: 11.5px var(--mono); color: var(--ink-2); }
  .key i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  button { font: 500 12.5px/1 var(--sans); color: var(--ink-2); background: color-mix(in srgb, var(--plot) 86%, transparent); border: 0; border-radius: 6px; padding: 7px 10px; cursor: pointer; white-space: nowrap; box-shadow: inset 0 0 0 1px var(--rule); }
  button:hover { color: var(--ink); }
  .views button { box-shadow: none; background: transparent; }
  button[aria-pressed='true'] { color: var(--ink); background: var(--brand-soft); box-shadow: inset 0 0 0 1px var(--brand); }
  button.primary { color: var(--ground); background: var(--brand); box-shadow: none; min-width: 58px; }
  .slow { font-size: 12px; color: var(--ink-3); }
  .tip { position: absolute; z-index: 3; pointer-events: none; padding: 6px 9px; border-radius: 6px; background: var(--plot); box-shadow: 0 0 0 1px var(--rule), 0 8px 24px rgba(0, 0, 0, 0.2); font-size: 12.5px; font-weight: 500; white-space: nowrap; }
  .tip small { display: block; font-size: 11px; font-weight: 400; color: var(--ink-3); }
  .info { position: absolute; z-index: 3; left: 10px; bottom: 56px; width: min(360px, calc(100% - 20px)); display: grid; gap: 8px; padding: 14px 16px; border-radius: 10px; background: var(--plot); box-shadow: 0 0 0 1px var(--rule), 0 14px 36px rgba(10, 14, 20, 0.22); }
  .info-head { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
  .info h2 { margin: 3px 0 0; font-size: 17px; font-weight: 550; letter-spacing: -0.015em; }
  .cat { display: flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink-2); }
  .cat i { width: 8px; height: 8px; border-radius: 2px; }
  .info p { margin: 0; color: var(--ink-2); font-size: 13px; line-height: 1.55; }
  .info dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0; font-size: 12.5px; }
  .info dt { color: var(--ink-3); }
  .info dd { margin: 0; font-size: 12px; }
  .info .primary { justify-self: start; }
  @media (max-width: 1180px) { .work { grid-template-columns: minmax(0, 1fr) 300px; } .slow { display: none; } }
  @media (max-width: 900px) {
    .work { grid-template-columns: minmax(0, 1fr); }
    .stage { height: 62vh; min-height: 380px; }
    .play { right: 10px; }
    .key { top: 52px; bottom: auto; right: 10px; }
    .controls { gap: 10px; width: 100%; }
    .pick { width: 100%; justify-content: space-between; }
  }
</style>

# Circuits & Systems Classroom

Interactive lessons on data converters, PLLs, clocking and circuit analysis, served at
<https://circuits-and-systems.tokenzhang.com>. ADC pages run ports of
[ADCToolbox](https://github.com/Arcadia-1/ADCToolbox) models in the browser. The library's reference manual remains at
<https://adctoolbox.tokenzhang.com/doc/>.

The site is static [Astro](https://astro.build) with [Svelte 5](https://svelte.dev) islands in strict TypeScript.

## Commands

Run these in `web/` with Node 22.12 or newer and pnpm 11.

| Command | Action |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server at <http://localhost:4321> |
| `pnpm check` | Type-check Astro, Svelte and the analytics Worker, then run the model tests |
| `pnpm build` | Build the static site into `dist/` |
| `pnpm preview` | Serve `dist/` locally |
| `pnpm deploy:analytics` | Deploy the analytics Worker (needs a Cloudflare login with Workers access) |

## Layout

| Path | Contents |
|---|---|
| `src/pages/` | Home, 404 and one `.astro` route per illustration |
| `src/illustrations/<topic>/` | One illustration: `model.ts` with the simulation as pure functions, plus its Svelte components |
| `src/components/` | Shared controls in `ui/`, chart primitives in `chart/`, compact lesson links and the shared navigation/footer |
| `src/lib/` | Number formatting, seeded random numbers, FFT, scales |
| `src/styles/` | Design tokens and chart classes in `global.css`, the shared illustration page layout in `illustration.css` |
| `src/data/illustrations.ts` | Topics and entries on the home page |
| `tests/` | Vitest checks of each TypeScript model against numbers from its Python reference |
| `python/` | Executable Python references: ADC models using ADCToolbox, plus PLL and amplifier models using NumPy |
| `public/` | Favicon and Cloudflare Pages response headers |
| `analytics/` | Copied analytics module: tracking, dashboard, routes and Durable Object |
| `functions/` | Host-aware redirects from the former tutorial URLs to the new domain |
| `worker/` | Analytics Worker that mounts the same historical counter on both domains at `/api/*` |

## Illustrations

- **Open-loop & closed-loop gain** at `/amplifiers/open-loop-and-closed-loop/`. Adjust A₀ and β independently in two cases.
  In **Hold open loop**, chosen A₀ and fOL remain fixed as β changes the closed-loop gain and bandwidth.
  In **Hold closed-loop BW**, the target fCL stays fixed and the model solves `fOL = fCL/(1 + βA₀)` and the required GBW.
  Both cases share fixed frequency axes while A₀ or β moves. The lesson fills the viewport between header and visitor
  footer; narrow screens switch cases instead of stacking plots. No duplicate title, Reset or Model notes toolbar.
  Synchronized magnitude/phase plots distinguish gain error, −3 dB bandwidth and the two unity crossings. Complex-response values are checked against independent
  NumPy division; tests also verify the exact `T₀ × fCL = GBW` identity and weak-feedback limits. The source figure in
  `../code/plot_bandwidth_comparison.py` uses the same complex transfer function.
- **Integer-N vs fractional-N PLL** at `/pll/integer-vs-fractional/`. A reference-rate time-domain simulation of two loops that
  share one reference, loop filter and VCO. The fractional-N divider is an accumulator, a MASH 1-1-1, or a MASH 1-1-1 with a
  DTC that has adjustable INL.
- **Binary vs redundant SAR ADC** at `/adc/binary-vs-redundant-sar/`. The SAR conversion, unit-capacitor mismatch, sine-fit weight
  calibration and spectrum analysis are ports of [ADCToolbox](https://github.com/Arcadia-1/ADCToolbox), checked against it to
  0.001 ENOB. The page steps through one conversion and compares the output spectra of both converters before and after
  calibration. It grows out of [ADC_Visualization](https://github.com/Arcadia-1/ADC_Visualization).

## Adding an illustration

1. Write the model in `src/illustrations/<topic>/model.ts`, a Python reference in `python/` and a test in `tests/`.
2. Build the page component next to the model from the shared `ui` and `chart` components.
3. Add a route in `src/pages/<topic>/` that renders the component with `client:load` and imports `illustration.css`.
4. List it in `src/data/illustrations.ts` and draw its thumbnail in `src/components/Thumb.astro`. Add reviewed lessons to
   `src/data/publication.ts` so they appear in the catalog and sitemap; register any new route prefix in `isLessonPath`
   and `functions/_middleware.js`.
5. Run `pnpm check` and `pnpm build`.

## Analytics

`analytics/` is the copyable first-party analytics module of analog-arena (`site/analytics` in Arcadia-1/analog-arena): the
tracking hook, the dashboard page and styles, the world-map data, the HTTP routes and the Durable Object. It is identical
to the source except for the page title; update it by copying the folder again. The host wires it in three places:

- `src/components/Visits.tsx` calls `useVisitStats` on every page through `Base.astro` and shows the totals in every shared
  page footer.
- `src/pages/analytics.astro` mounts the dashboard at `/analytics/` with the mono font, theme class and reset it expects.
- `worker/index.ts` registers the routes on Hono and exports the Durable Object. The Worker is routed on `/api/*` in
  front of the Pages site and deployed with `pnpm deploy:analytics`.

## Deploy

`.github/workflows/deploy-web.yml` installs, checks and builds the site for every pull request that touches `web/`. On `main` it
deploys `dist/` to the existing Cloudflare Pages project `ams-class`, ensures
`circuits-and-systems.tokenzhang.com` is attached, and preserves the host-aware redirects. The analytics Worker route for
both domains is declared in `worker/wrangler.jsonc` and deployed separately with `pnpm deploy:analytics`. The old host keeps
the ADCToolbox manual; its home page and tutorial paths redirect to the matching path on the new host.

## Editorial and visual direction

Use **Circuits & Systems Classroom** as the site brand. The public catalog is intentionally small: four reviewed ADC
lessons, one PLL lesson, one amplifier lesson and the selected Bode-plot tool. Other experiments remain available by direct URL with `noindex`
until they reach the same standard. The ADCToolbox manual remains the reference for the Python API and longer examples.

Each entry has its own schematic preview so readers can recognize the experiment at a glance; model provenance and example
names belong inside the lesson notes. Keep the two-column editorial layout on wide screens and one column on phones.

The shared header and footer, restrained borders, system sans font, Google Sans Code labels and green accent follow
Analog Design Bench. Plot series use separate blue/amber colors. The theme follows the system until the reader makes
an explicit choice; that choice is stored locally.

## Numerical verification

See [the 2026-09-20 scientific audit](SCIENTIFIC-AUDIT-2026-09-20.md) for the scope, analytical checks, corrected
calculations and the external Bode tool's known marginal-stability limitation. `tests/scientific-audit.test.ts`
checks independent signal identities in addition to the Python regression comparisons.

For reproducible reference results, install the verified library revision from the repository root:

```sh
python -m pip install -r web/python/requirements.txt
```

The pin includes the time-interleaved ADC offset-spur correction, which is not in the PyPI 0.9.1 release.
Then verify every example:

```sh
MPLBACKEND=Agg python .github/toolbox-drift.py
```

CI also runs this check against ADCToolbox main to detect upstream changes.

This executes every script in `web/python/` and compares its output with `web/python/expected/`. The PLL script uses
a fixed random seed and leaves execution timing out of the output. Vitest separately checks the browser models
against Python reference values and physical invariants. The deployment waits for both checks to pass.

Only refresh expected output after investigating a difference and updating the corresponding browser model and tests.

## Keep the visitor counter

The shared footer must always show cumulative visitors and page views, with a link to `/analytics/`. Render the
counter before hydration; use “—” while totals are unavailable, and display real zero counts as zero. Never remove
the counter as part of a visual redesign.

`Visits.tsx` reads `/api/stats` without recording a visit, so the totals can still appear when the tracking request
is skipped or fails. The existing `/api/hit` hook records at most one visit per navigation. Preserve the existing
Worker name, Durable Object binding and object name, schema version and cookies documented in `analytics/README.md`
to keep the historical counts. A static local preview without the analytics Worker shows the placeholder.

# ADCToolbox site

The tutorial companion to [ADCToolbox](https://github.com/Arcadia-1/ADCToolbox), served at <https://adctoolbox.tokenzhang.com> with
the library's reference manual under `/doc/`. Each page runs a port of the library's models in the browser, so every control
changes the physics you see.

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
| `python/` | Executable Python references for all ten lessons: nine ADC models using ADCToolbox and one PLL model using NumPy |
| `public/` | Favicon and Cloudflare Pages response headers |
| `analytics/` | Copied analytics module: tracking, dashboard, routes and Durable Object |
| `worker/` | Analytics Worker that mounts the module on `adctoolbox.tokenzhang.com/api/*` |

## Illustrations

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
4. List it in `src/data/illustrations.ts` and draw its thumbnail in `src/components/Thumb.astro`.
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
also deploys `dist/` to the Cloudflare Pages project `ams-class` (the site's first name, kept as an internal one; its only
domain is `adctoolbox.tokenzhang.com`), using the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

## Editorial and visual direction

Keep **ADC Toolbox** as the site brand. ADC tutorials are the main curriculum; PLL and Bode plots sit under
“More to explore”. The manual remains the reference for the Python API and longer examples.

The catalog follows a learning order: sampling, conversion, error analysis, calibration, then advanced architectures.
Each entry has its own schematic preview with the title directly underneath; the home-page catalog does not show subtitles.
Keep the preview visible at every screen size so readers can recognize the experiment at a glance; model provenance and
example names belong inside the lesson notes. Use a four-column waterfall on wide screens, then three, two and one column
as the viewport narrows.

The shared header and footer, restrained borders, system sans font, Google Sans Code labels and green accent follow
Analog Design Bench. Plot series use separate blue/amber colors. The theme follows the system until the reader makes
an explicit choice; that choice is stored locally.

## Numerical verification

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

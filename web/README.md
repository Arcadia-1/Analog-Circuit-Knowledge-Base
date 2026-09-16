# ADCToolbox site

The interactive side of [ADCToolbox](https://github.com/Arcadia-1/ADCToolbox), served at <https://adctoolbox.tokenzhang.com> with
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
| `src/components/` | Shared controls in `ui/`, chart primitives in `chart/`, home page thumbnails |
| `src/lib/` | Number formatting, seeded random numbers, FFT, scales |
| `src/styles/` | Design tokens and chart classes in `global.css`, the shared illustration page layout in `illustration.css` |
| `src/data/illustrations.ts` | Topics and entries on the home page |
| `tests/` | Vitest checks of each TypeScript model against numbers from its Python reference |
| `python/` | Python references: the PLL model in NumPy, and SAR numbers computed with ADCToolbox (`pip install adctoolbox==0.9.1`) |
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

- `src/components/Visits.tsx` calls `useVisitStats` on every page through `Base.astro` and shows the totals in the home
  page footer.
- `src/pages/analytics.astro` mounts the dashboard at `/analytics/` with the mono font, theme class and reset it expects.
- `worker/index.ts` registers the routes on Hono and exports the Durable Object. The Worker is routed on `/api/*` in
  front of the Pages site and deployed with `pnpm deploy:analytics`.

## Deploy

`.github/workflows/deploy-web.yml` installs, checks and builds the site for every pull request that touches `web/`. On `main` it
also deploys `dist/` to the Cloudflare Pages project `ams-class` (the site's first name, kept as an internal one; its only
domain is `adctoolbox.tokenzhang.com`), using the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

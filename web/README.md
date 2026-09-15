# AMS Class

Interactive illustrations of analog and mixed-signal circuits, served at <https://ams-class.tokenzhang.com>. Each page runs a
small behavioural model in the browser, so every control changes the physics you see.

The site is static [Astro](https://astro.build) with [Svelte 5](https://svelte.dev) islands in strict TypeScript.

## Commands

Run these in `web/` with Node 22.12 or newer and pnpm 11.

| Command | Action |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server at <http://localhost:4321> |
| `pnpm check` | Type-check Astro and Svelte files, then run the model tests |
| `pnpm build` | Build the static site into `dist/` |
| `pnpm preview` | Serve `dist/` locally |

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

## Deploy

`.github/workflows/deploy-web.yml` installs, checks and builds the site for every pull request that touches `web/`. On `main` it
also deploys `dist/` to the Cloudflare Pages project `ams-class`, using the repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

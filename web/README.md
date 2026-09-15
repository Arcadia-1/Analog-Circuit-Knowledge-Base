# AMS Class site

Interactive illustrations served at <https://ams-class.tokenzhang.com>.

## Layout

| Path | Contents |
|---|---|
| `pages/<topic>/<name>/` | One interactive page: `shell.html` (markup and styles), `charts.css`, `model.js`, `render_a.js`, `render_b.js`, plus an optional Python reference model |
| `static/` | Site home page, 404 page, favicon and response headers, copied as is |
| `build.py` | Inlines every page into one self-contained `index.html` under `dist/` |

## Build and preview

```bash
python3 web/build.py
python3 -m http.server 8000 --directory web/dist
```

## Deploy

Pushing changes under `web/` to `main` runs `.github/workflows/deploy-web.yml`, which builds the site and deploys it to the
Cloudflare Pages project `ams-class`. The workflow needs the repository secrets `CLOUDFLARE_API_TOKEN` (Pages edit access)
and `CLOUDFLARE_ACCOUNT_ID`.

## Adding an illustration

1. Create `pages/<topic>/<name>/` with the same five files as `pages/pll/integer-vs-fractional/`.
2. Add an entry for it to `static/index.html`.
3. Run `python3 web/build.py` and check the page locally.

## Integer-N vs fractional-N PLL

`pages/pll/integer-vs-fractional/` compares an integer-N and a fractional-N PLL that share one reference, one loop filter and one
VCO. `model.js` is a reference-rate time-domain simulation; `reference_model.py` implements the same equations in Python and
agrees with the page to about 1 %.

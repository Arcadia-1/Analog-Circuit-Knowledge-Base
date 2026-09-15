#!/usr/bin/env python3
"""Build the AMS Class site.

Each directory under web/pages/ that contains shell.html is one interactive page. Its CSS and JS are
inlined into a single self-contained HTML file and written to web/dist/<same path>/index.html.
Everything in web/static/ is copied to web/dist/ as is.

    python3 web/build.py                     # build web/dist/
    python3 web/build.py --artifact OUT.html pll/integer-vs-fractional
                                             # unwrapped single page (no <html>/<head>), for embedding
"""
import argparse, html, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent
PAGES, STATIC, DIST = ROOT / "pages", ROOT / "static", ROOT / "dist"
SITE_URL = "https://ams-class.tokenzhang.com"
CRUMB = '<a class="crumb" href="/">AMS Class</a>'


def assemble(page_dir: pathlib.Path) -> str:
    shell = (page_dir / "shell.html").read_text()
    shell = shell.replace("</style>", (page_dir / "charts.css").read_text() + "</style>", 1)
    render = (page_dir / "render_a.js").read_text() + "\n" + (page_dir / "render_b.js").read_text()
    return shell.replace("/*__MODEL__*/", (page_dir / "model.js").read_text()).replace("/*__RENDER__*/", render)


def wrap(page: str, rel: str) -> str:
    head, body = page[: page.index("<main")], page[page.index("<main"):]
    title = re.search(r"<title>(.*?)</title>", head, re.S).group(1)
    desc_m = re.search(r'<meta name="description" content="(.*?)">', head)
    desc = desc_m.group(1) if desc_m else ""
    url = f"{SITE_URL}/{rel}/" if rel else f"{SITE_URL}/"
    meta = (
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
        f'<link rel="canonical" href="{url}">\n'
        f'<meta property="og:type" content="website">\n<meta property="og:site_name" content="AMS Class">\n'
        f'<meta property="og:title" content="{html.escape(title, quote=True)}">\n'
        f'<meta property="og:description" content="{desc}">\n<meta property="og:url" content="{url}">\n'
    )
    return f'<!doctype html>\n<html lang="en">\n<head>\n{meta}{head}</head>\n<body>\n{body}\n</body>\n</html>\n'


def build_site():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST)
    for shell in sorted(PAGES.rglob("shell.html")):
        page_dir = shell.parent
        rel = page_dir.relative_to(PAGES).as_posix()
        out = DIST / rel / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(wrap(assemble(page_dir).replace("<!--__CRUMB__-->", CRUMB), rel))
        print(f"page  /{rel}/  ({out.stat().st_size / 1024:.0f} KB)")
    print(f"site built in {DIST}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--artifact", nargs=2, metavar=("OUT", "PAGE"))
    a = ap.parse_args()
    if a.artifact:
        out, rel = a.artifact
        pathlib.Path(out).write_text(assemble(PAGES / rel).replace("    <!--__CRUMB__-->\n", ""))
        print(f"artifact page written to {out}")
    else:
        build_site()

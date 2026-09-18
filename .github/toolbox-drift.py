#!/usr/bin/env python3
"""Check every lesson against its executable Python reference.

Every page's model is a TypeScript port whose tests pin the numbers web/python/*.py printed when the page was written.
Those tests cannot see the library move on: change a ported function in ADCToolbox and they stay green while the page
quietly stops matching it. So rerun every ADC script against the library as installed, plus the NumPy PLL reference, and compare
what it prints with the copy kept in web/python/expected/. A decimal may differ by one count in its last printed digit,
which is rounding on another platform rather than a change; everything else has to match.

    python3 .github/toolbox-drift.py            compare
    python3 .github/toolbox-drift.py --update   accept the library's numbers, once the ports and their tests follow them
"""
import difflib
import os
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "web" / "python"
EXPECTED = SCRIPTS / "expected"
NUMBER = re.compile(r"[-+]?\d+(?:\.(\d+))?")


def run(script: Path) -> str:
    env = dict(os.environ, MPLBACKEND="Agg")
    return subprocess.run([sys.executable, str(script)], env=env, check=True, stdout=subprocess.PIPE, text=True).stdout


def agrees(expected: str, actual: str) -> bool:
    kept, now = expected.splitlines(), actual.splitlines()
    if len(kept) != len(now):
        return False
    for k, n in zip(kept, now):
        # column padding follows the width of the numbers, so compare the words around them, not the spacing
        if NUMBER.sub("#", k).split() != NUMBER.sub("#", n).split():
            return False
        for a, b in zip(NUMBER.finditer(k), NUMBER.finditer(n)):
            if a.group(1) is None:
                if a.group() != b.group():
                    return False
            elif abs(float(a.group()) - float(b.group())) > 1.001 * 10.0 ** -len(a.group(1)):
                return False
    return True


def main(update: bool) -> None:
    drifted = []
    for script in sorted(SCRIPTS.glob("*.py")):
        actual = run(script)
        kept = EXPECTED / f"{script.stem}.txt"
        if update:
            EXPECTED.mkdir(exist_ok=True)
            kept.write_text(actual, encoding="utf-8")
            print(f"  kept what {script.name} prints now")
        elif not kept.exists():
            drifted.append(f"{script.name}: nothing kept to compare with; run with --update")
        elif not agrees(kept.read_text(encoding="utf-8"), actual):
            diff = difflib.unified_diff(
                kept.read_text(encoding="utf-8").splitlines(), actual.splitlines(),
                f"expected/{kept.name}", "Python reference now", lineterm="",
            )
            drifted.append(f"{script.name} no longer matches its Python reference:\n" + "\n".join(diff))
        else:
            print(f"  {script.name} matches its Python reference")
    if drifted:
        raise SystemExit("\n\n".join(drifted))


if __name__ == "__main__":
    main("--update" in sys.argv[1:])

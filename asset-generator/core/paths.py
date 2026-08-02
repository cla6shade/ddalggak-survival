"""Where the work lives.

One directory for everything: the code, the specs, the sprites, the packed
atlas. `ROOT` is the source tree, and every path in the pipeline hangs off it.

It is also the sandbox codex is given — a path outside `ROOT` is a path the
generator cannot open, which is why references are copied inside before use.
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

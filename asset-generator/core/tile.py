"""Measure whether a texture actually tiles.

A tile that does not wrap looks perfectly fine on its own — the seam only shows
up once it is repeated, which is exactly when nobody is looking at the asset
pipeline any more. So the check runs at build time.

The test is relative, not absolute. A floor is full of hard edges, so "the wrap
columns differ" proves nothing; what matters is whether they differ *more* than
two neighbouring columns inside the image typically do. A ratio near 1 means the
wrap is as ordinary as any other pair of adjacent columns, which is what seamless
means. A large ratio means the edge is a feature you can see.
"""

from __future__ import annotations

from PIL import Image

Edges = tuple[float, float]


def _mean_abs_diff(a: list[tuple], b: list[tuple]) -> float:
    total = sum(abs(p[i] - q[i]) for p, q in zip(a, b) for i in range(3))
    return total / (3 * len(a)) if a else 0.0


def _cols(img: Image.Image, x: int) -> list[tuple]:
    px = img.load()
    return [px[x, y] for y in range(img.height)]


def _rows(img: Image.Image, y: int) -> list[tuple]:
    px = img.load()
    return [px[x, y] for x in range(img.width)]


def seam_ratios(path) -> Edges:
    """(horizontal, vertical) wrap discontinuity, relative to the interior.

    1.0 means the wrap is an average adjacent-line step. Under ~2 reads as
    seamless; a hard border shows up as a much larger number.
    """
    img = Image.open(path).convert("RGB")
    w, h = img.size

    wrap_x = _mean_abs_diff(_cols(img, w - 1), _cols(img, 0))
    inner_x = [_mean_abs_diff(_cols(img, x), _cols(img, x + 1)) for x in range(w - 1)]
    wrap_y = _mean_abs_diff(_rows(img, h - 1), _rows(img, 0))
    inner_y = [_mean_abs_diff(_rows(img, y), _rows(img, y + 1)) for y in range(h - 1)]

    def ratio(wrap: float, inner: list[float]) -> float:
        typical = sum(inner) / len(inner) if inner else 0.0
        if typical == 0:                      # a flat colour tiles trivially
            return 1.0 if wrap == 0 else float("inf")
        return wrap / typical

    return ratio(wrap_x, inner_x), ratio(wrap_y, inner_y)

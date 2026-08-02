"""Cutout rigging: build animation frames from ONE sprite by moving rectangles.

There are no bones and no rotation. A part is a rectangle of the finished pixel
sprite, and a clip frame is an integer (dx, dy) per part. Rotation would have to
resample the image, which destroys a 64px sprite's outline — translation never
touches a pixel's value, so a rigged frame is exactly as clean as the source.

What this buys over asking the model for a sheet: the silhouette cannot boil, a
prop cannot swap hands, and the amount of motion is a number you control instead
of a sentence you hope lands. What it costs: only motions expressible as
translation. Big pose changes still need a generated sheet.
"""

from __future__ import annotations

from PIL import Image

Box = tuple[int, int, int, int]      # x0, y0, x1, y1
Offset = tuple[int, int]

BODY = "body"                        # reserved part name: moves the whole frame


def compose(base: Image.Image, parts: dict[str, Box],
            moves: dict[str, Offset]) -> Image.Image:
    """Render one clip frame. Parts not named in `moves` stay at rest."""
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    for name, box in parts.items():
        dx, dy = moves.get(name, (0, 0))
        layer.paste(base.crop(box), (box[0] + dx, box[1] + dy))

    # The body keeps its own copy of everything except the part rectangles, and
    # composites on top — so a lifted leg slides under the shirt hem rather than
    # painting over it.
    body = base.copy()
    for box in parts.values():
        body.paste(Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0)),
                   (box[0], box[1]))

    frame = Image.alpha_composite(layer, body)

    bdx, bdy = moves.get(BODY, (0, 0))
    if (bdx, bdy) != (0, 0):
        shifted = Image.new("RGBA", base.size, (0, 0, 0, 0))
        shifted.paste(frame, (bdx, bdy))
        frame = shifted
    return frame


def render_clip(base: Image.Image, parts: dict[str, Box],
                frames: list[dict[str, Offset]]) -> list[Image.Image]:
    return [compose(base, parts, moves) for moves in frames]


def suggest_parts(sprite: Image.Image) -> dict[str, Box]:
    """Guess the part rectangles the presets know how to ask for. Hints, not
    decisions — a spec that names its own `[rig] parts` overrides all of this.

    One profiling pass serves both answers. Finding where the legs start is the
    only measurement either of them needs: below that line are the legs, above it
    is everything else.
    """
    px = sprite.load()
    w, h = sprite.size

    top = _leg_top(px, w, h)
    if top is None:
        return {}

    # Everything above the legs, moved as one piece. A breathing loop is this
    # rectangle sinking a pixel or two while the feet stay where they are —
    # which is what "the body sinks but the feet stay planted" actually means.
    parts: dict[str, Box] = {"upper": (0, 0, w, top)}
    parts.update(_split_legs(px, w, h, top) or {})
    return parts


def _leg_top(px, w: int, h: int) -> int | None:
    """The row where the legs begin.

    Assumes the common case of dark trousers below a lighter torso: scan up from
    the bottom for the last row that still has no light pixels.
    """

    def light_count(y: int) -> int:
        n = 0
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and 0.299 * r + 0.587 * g + 0.114 * b > 170:
                n += 1
        return n

    for y in range(h - 1, -1, -1):
        if light_count(y):
            return y + 1 if h - (y + 1) >= 4 else None
    return None


def _split_legs(px, w: int, h: int, top: int) -> dict[str, Box] | None:
    """Split the leg band at its thinnest column — the gap between the legs."""
    band = h - top
    cols = {x: sum(1 for y in range(top, h) if px[x, y][3]) for x in range(w)}

    # Keep only columns the legs actually fill. Stray bits — a shoe tip, the
    # bottom of a held prop — are sparse, and they sit further out than the gap,
    # so an unfiltered minimum lands on them instead of between the legs.
    solid = [x for x, n in cols.items() if n >= band * 0.6]
    if len(solid) < 6:
        return None
    x0, x1 = min(solid), max(solid) + 1

    # The gap is a dip near the middle, not at the edges where the legs taper.
    span = x1 - x0
    interior = range(x0 + max(2, span // 4), x1 - max(2, span // 4))
    if not interior:
        return None
    split = min(interior, key=lambda x: (cols[x], abs(x - (x0 + x1) / 2)))

    return {"leg_l": (x0, top, split, h), "leg_r": (split, top, x1, h)}

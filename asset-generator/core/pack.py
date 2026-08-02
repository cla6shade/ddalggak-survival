"""Stage 3: pack the pixel sprites into a single atlas texture.

MaxRects with the best-short-side-fit heuristic, implemented here so the build
has no packer dependency. Placement is fully deterministic: sprites are sorted
by size then id, and ties in the fit heuristic break on (y, x).

Each sprite is trimmed to its alpha bounding box — the offsets are recorded so
the renderer can put it back — then extruded by 1px and separated by padding, so
that a filtered or non-integer-scaled draw can never sample a neighbour.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image

MAX_ATLAS = 4096


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    w: int
    h: int

    @property
    def right(self) -> int:
        return self.x + self.w

    @property
    def bottom(self) -> int:
        return self.y + self.h

    def contains(self, other: "Rect") -> bool:
        return (self.x <= other.x and self.y <= other.y
                and other.right <= self.right and other.bottom <= self.bottom)

    def overlaps(self, other: "Rect") -> bool:
        return not (other.x >= self.right or other.right <= self.x
                    or other.y >= self.bottom or other.bottom <= self.y)


@dataclass
class Frame:
    """One packed sprite, in the coordinates an atlas consumer needs."""
    name: str
    rect: Rect              # trimmed pixels inside the atlas
    offset: tuple[int, int]  # where the trimmed region sat in the source canvas
    source: tuple[int, int]  # untrimmed canvas size


class MaxRects:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.free = [Rect(0, 0, width, height)]

    def insert(self, w: int, h: int) -> Rect | None:
        best: Rect | None = None
        best_score: tuple | None = None
        for fr in self.free:
            if fr.w < w or fr.h < h:
                continue
            leftover = (fr.w - w, fr.h - h)
            score = (min(leftover), max(leftover), fr.y, fr.x)
            if best_score is None or score < best_score:
                best_score, best = score, Rect(fr.x, fr.y, w, h)
        if best is None:
            return None

        split: list[Rect] = []
        for fr in self.free:
            split.extend(_split(fr, best))
        self.free = _prune(split)
        return best


def _split(free: Rect, used: Rect) -> list[Rect]:
    if not free.overlaps(used):
        return [free]
    pieces = []
    if used.x > free.x:
        pieces.append(Rect(free.x, free.y, used.x - free.x, free.h))
    if used.right < free.right:
        pieces.append(Rect(used.right, free.y, free.right - used.right, free.h))
    if used.y > free.y:
        pieces.append(Rect(free.x, free.y, free.w, used.y - free.y))
    if used.bottom < free.bottom:
        pieces.append(Rect(free.x, used.bottom, free.w, free.bottom - used.bottom))
    return [p for p in pieces if p.w > 0 and p.h > 0]


def _prune(rects: list[Rect]) -> list[Rect]:
    kept: list[Rect] = []
    for a in rects:
        if any(b.contains(a) for b in kept):
            continue
        kept = [b for b in kept if not a.contains(b)]
        kept.append(a)
    return kept


def _trim(img: Image.Image) -> tuple[Image.Image, tuple[int, int]]:
    box = img.getchannel("A").getbbox()
    if box is None:                       # fully transparent: keep one pixel
        return img.crop((0, 0, 1, 1)), (0, 0)
    return img.crop(box), (box[0], box[1])


def _paste_extruded(atlas: Image.Image, img: Image.Image, x: int, y: int, e: int) -> None:
    """Paste, then smear the border outward so filtering cannot reach a neighbour."""
    atlas.paste(img, (x, y))
    if e <= 0:
        return
    w, h = img.size
    left, right = img.crop((0, 0, 1, h)), img.crop((w - 1, 0, w, h))
    for i in range(1, e + 1):
        atlas.paste(left, (x - i, y))
        atlas.paste(right, (x + w - 1 + i, y))
    # widened strips so the corners get filled too
    top = atlas.crop((x - e, y, x + w + e, y + 1))
    bottom = atlas.crop((x - e, y + h - 1, x + w + e, y + h))
    for i in range(1, e + 1):
        atlas.paste(top, (x - e, y - i))
        atlas.paste(bottom, (x - e, y + h - 1 + i))


def pack(sources: list[tuple[str, Path]], extrude: int = 1,
         padding: int = 2) -> tuple[Image.Image, list[Frame]]:
    """Pack named PNGs into the smallest power-of-two square atlas that fits."""
    loaded = []
    for name, path in sources:
        img = Image.open(path).convert("RGBA")
        trimmed, offset = _trim(img)
        loaded.append((name, trimmed, offset, img.size))

    # biggest first is what makes MaxRects behave; id breaks ties deterministically
    loaded.sort(key=lambda item: (-max(item[1].size), -min(item[1].size), item[0]))

    margin = 2 * extrude + padding
    size = 64
    while size <= MAX_ATLAS:
        bin_ = MaxRects(size, size)
        placed: list[tuple] = []
        for name, trimmed, offset, source in loaded:
            slot = bin_.insert(trimmed.width + margin, trimmed.height + margin)
            if slot is None:
                break
            placed.append((name, trimmed, offset, source, slot))
        if len(placed) == len(loaded):
            break
        size *= 2
    else:
        raise RuntimeError(f"sprites do not fit in a {MAX_ATLAS}x{MAX_ATLAS} atlas")

    atlas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    frames: list[Frame] = []
    for name, trimmed, offset, source, slot in placed:
        x, y = slot.x + extrude, slot.y + extrude
        _paste_extruded(atlas, trimmed, x, y, extrude)
        frames.append(Frame(
            name=name,
            rect=Rect(x, y, trimmed.width, trimmed.height),
            offset=offset,
            source=source,
        ))

    frames.sort(key=lambda f: f.name)
    return atlas, frames

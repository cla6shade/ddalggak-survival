"""Convert a cut-out RGBA image into a hard-edged pixel-art sprite.

Deterministic: same input + same flags always produce the same bytes.

Steps:
  1. trim to the alpha bounding box
  2. area-average downscale to fit the target canvas, aspect preserved
     (reserving a margin when an outline will be grown outward)
  3. binarize alpha so edges are hard (no semi-transparent pixel-art fringe)
  4. quantize colors with median-cut over opaque pixels only, no dithering
  5. optionally grow a crisp N-px outline outward from the silhouette,
     and/or darken the outer 1px rim

Generated art loses its drawn outline in the downscale, so the intended path is
to generate WITHOUT an outline and rebuild it here via `add_outline_width`.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


def fit_canvas(img: Image.Image, size: int, inset: int = 0,
               anchor: str = "center") -> Image.Image:
    """Downscale with area averaging, then place on a square transparent canvas.

    `inset` shrinks the target box on every side so a later outline has room to
    grow outward without being clipped by the canvas edge.

    `anchor` of "bottom" sits the art on the bottom of that box instead of
    centring it vertically. Every prop then shares one baseline, so the game can
    draw them all at origin (0.5, 1) and have a stool and a partition both stand
    on the floor rather than float by half their spare height.
    """
    box = max(1, size - 2 * inset)
    scale = min(box / img.width, box / img.height)
    w = max(1, round(img.width * scale))
    h = max(1, round(img.height * scale))
    small = img.resize((w, h), Image.BOX)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    y = size - inset - h if anchor == "bottom" else (size - h) // 2
    canvas.paste(small, ((size - w) // 2, y))
    return canvas


def fill_canvas(img: Image.Image, size: int) -> Image.Image:
    """Squash the whole image onto the canvas: no trim, no padding, no anchor.

    A tiling material owns every pixel out to the edge, so trimming to an alpha
    box or centring inside a margin would both destroy the wrap.
    """
    return img.convert("RGBA").resize((size, size), Image.BOX)


def binarize_alpha(img: Image.Image, threshold: int) -> Image.Image:
    a = img.getchannel("A").point(lambda v: 255 if v >= threshold else 0)
    out = img.copy()
    out.putalpha(a)
    return out


Color = tuple[int, int, int]


def palette_image(colors: list[Color]) -> Image.Image:
    """A mode-P image carrying exactly `colors`, for use as a quantize target.

    The 256 slots are padded by repeating the last colour rather than with
    zeros: an unused slot still competes for pixels, and a slab of black ones
    would pull every dark tone onto (0, 0, 0).
    """
    pal = Image.new("P", (1, 1))
    flat = [v for c in colors for v in c]
    flat += list(colors[-1]) * (256 - len(colors))
    pal.putpalette(flat[:768])
    return pal


def distinct_opaque(images: list[Image.Image]) -> list[Color]:
    """Every RGB value that survives quantization, most-used first."""
    counts: dict[Color, int] = {}
    for img in images:
        rgb = img.convert("RGB").load()
        alpha = img.getchannel("A").load()
        for y in range(img.height):
            for x in range(img.width):
                if alpha[x, y]:
                    counts[rgb[x, y]] = counts.get(rgb[x, y], 0) + 1
    return [c for c, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]


def quantize_opaque(images: list[Image.Image], colors: int,
                    palette: list[Color] | None = None
                    ) -> tuple[list[Image.Image], list[Color]]:
    """Map every frame through ONE palette; returns the frames and that palette.

    With `palette` given, the frames are snapped to those exact colours — that is
    how two sheets of the same character end up sharing a skin tone instead of
    each median-cutting its own. Without it, the palette is median-cut from the
    opaque pixels of these frames.

    Transparent RGB is excluded so it cannot pollute the palette, and all frames
    share one palette either way — a per-frame palette makes an animation flicker.
    """
    if palette:
        pal_src = palette_image(palette)
    else:
        opaque = bytearray()
        for img in images:
            rgb_bytes = img.convert("RGB").tobytes()
            for i, a in enumerate(img.getchannel("A").tobytes()):
                if a:
                    opaque += rgb_bytes[i * 3:i * 3 + 3]
        if not opaque:
            return images, []
        strip = Image.frombytes("RGB", (len(opaque) // 3, 1), bytes(opaque))
        pal_src = strip.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE)

    out = []
    for img in images:
        alpha = img.getchannel("A")
        mapped = img.convert("RGB").quantize(palette=pal_src, dither=Image.NONE).convert("RGB")
        mapped.putalpha(alpha)
        out.append(mapped)
    return out, distinct_opaque(out)


def add_outline(img: Image.Image, width: int, color: tuple[int, int, int]) -> Image.Image:
    """Grow a solid `width`-px outline outward from the opaque silhouette.

    Dilates the alpha mask with a 3x3 max filter (8-connected, so diagonals get
    covered too) and paints every newly-opaque pixel with `color`. Done after
    downscaling, this yields a crisp 1px line that no resample can blur.
    """
    alpha = img.getchannel("A")
    grown = alpha
    for _ in range(width):
        grown = grown.filter(ImageFilter.MaxFilter(3))

    # A solid slab masked by the dilated silhouette; compositing the original
    # over it leaves colour showing only in the grown ring.
    ring = Image.new("RGBA", img.size, (*color, 255))
    ring.putalpha(grown.point(lambda v: 255 if v else 0))
    return Image.alpha_composite(ring, img)


def strengthen_outline(img: Image.Image, factor: float) -> Image.Image:
    """Darken opaque pixels that touch a transparent neighbour."""
    px = img.load()
    w, h = img.size
    rim = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or px[nx, ny][3] == 0:
                    rim.append((x, y))
                    break
    for x, y in rim:
        r, g, b, a = px[x, y]
        px[x, y] = (int(r * factor), int(g * factor), int(b * factor), a)
    return img


def slice_sheet(img: Image.Image, rows: int, cols: int) -> list[Image.Image]:
    """Cut a sheet into rows x cols equal cells, in reading order."""
    cw, ch = img.width // cols, img.height // rows
    return [img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            for r in range(rows) for c in range(cols)]


def register(frames: list[Image.Image], mode: str) -> list[Image.Image]:
    """Cancel unintended per-frame drift before the frames are cropped together.

    The model places the subject a few pixels differently in each grid cell,
    which reads as jitter rather than as motion. `center-x` shifts every frame
    so the silhouettes share a horizontal centre; `bottom-center` also puts the
    feet on a common baseline. `none` trusts the sheet, which is what a jump or
    a lunge needs.
    """
    if mode == "none" or len(frames) < 2:
        return frames

    boxes = [f.getchannel("A").getbbox() for f in frames]
    if any(b is None for b in boxes):
        return frames

    target_cx = sum((b[0] + b[2]) / 2 for b in boxes) / len(boxes)
    target_bottom = max(b[3] for b in boxes)

    shifted = []
    for frame, box in zip(frames, boxes):
        dx = round(target_cx - (box[0] + box[2]) / 2)
        dy = target_bottom - box[3] if mode == "bottom-center" else 0
        if dx == 0 and dy == 0:
            shifted.append(frame)
            continue
        canvas = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        canvas.paste(frame, (dx, dy))
        shifted.append(canvas)
    return shifted


def common_crop(frames: list[Image.Image]) -> list[Image.Image]:
    """Crop every frame to the union of their alpha boxes.

    Trimming each frame to its own box would re-center it and delete exactly the
    per-frame motion the animation consists of. One shared box keeps the frames
    registered to each other.
    """
    boxes = [f.getchannel("A").getbbox() for f in frames]
    boxes = [b for b in boxes if b is not None]
    if not boxes:
        return frames
    union = (min(b[0] for b in boxes), min(b[1] for b in boxes),
             max(b[2] for b in boxes), max(b[3] for b in boxes))
    return [f.crop(union) for f in frames]


def pixelize_frames(frames: list[Image.Image], size: int, colors: int,
                    alpha_threshold: int, outline: float, add_outline_width: int,
                    outline_color: tuple[int, int, int],
                    palette: list[Color] | None = None, fit: str = "contain"
                    ) -> tuple[list[Image.Image], list[Color]]:
    """Run the pixel-art conversion over a set of already-registered frames.

    Returns the frames and the art palette. The outline colour is deliberately
    not in that palette: it is painted on after quantization, so borrowing this
    palette elsewhere carries the artwork's tones and nothing else.
    """
    if fit == "fill":
        out = [fill_canvas(f, size) for f in frames]
    else:
        anchor = "bottom" if fit == "bottom" else "center"
        out = [fit_canvas(f, size, inset=add_outline_width, anchor=anchor)
               for f in frames]
    out = [binarize_alpha(f, alpha_threshold) for f in out]
    out, used = quantize_opaque(out, colors, palette)
    if outline < 1.0:
        out = [strengthen_outline(f, outline) for f in out]
    if add_outline_width > 0:
        out = [add_outline(f, add_outline_width, outline_color) for f in out]
    return out, used


def pixelize(src: Path, dst: Path, size: int, colors: int, alpha_threshold: int,
             outline: float, add_outline_width: int, outline_color: tuple[int, int, int],
             preview_scale: int, rows: int = 1, cols: int = 1,
             align: str = "none", palette: list[Color] | None = None,
             fit: str = "contain") -> tuple[list[Path], list[Color]]:
    """Convert a cut-out image (or sheet) to pixel sprites.

    Returns the paths written and the art palette used, so a caller can hand
    that palette to another asset. A 1x1 sheet writes `dst`; a multi-frame sheet
    writes `dst`-stem_000.png etc.
    """
    img = Image.open(src).convert("RGBA")
    frames = slice_sheet(img, rows, cols) if rows * cols > 1 else [img]
    if fit != "fill":
        # Both of these work on the alpha box, which a full-bleed image does not
        # have — trimming one would crop the material and break the wrap.
        frames = register(frames, align)
        frames = common_crop(frames)
    frames, used = pixelize_frames(frames, size, colors, alpha_threshold,
                                   outline, add_outline_width, outline_color,
                                   palette, fit)

    dst.parent.mkdir(parents=True, exist_ok=True)
    written = []
    for i, frame in enumerate(frames):
        path = dst if len(frames) == 1 else dst.with_name(f"{dst.stem}_{i:03d}.png")
        frame.save(path)
        written.append(path)
        if preview_scale > 1:
            frame.resize((size * preview_scale,) * 2, Image.NEAREST) \
                 .save(path.with_name(f"{path.stem}@{preview_scale}x.png"))
    return written, used

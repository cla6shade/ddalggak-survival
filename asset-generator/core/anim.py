"""Looping transparent GIFs, for watching an animation before it is packed.

The old pipeline could only preview an animation by reading it back out of a
built atlas, which meant packing the whole project to check one walk cycle. This
works straight off the pixel frames on disk, so a clip can be judged the moment
it is rendered.

The palette is built once from every frame together. A per-frame adaptive palette
makes the colours crawl between frames, which reads as the sprite shimmering —
the exact artefact the single-palette rule in pixelize.py exists to prevent.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

# GIF has one transparent index and 256 slots; reserving the last one leaves 255
# for the artwork, which is far more than a 16-colour sprite needs.
TRANSPARENT_INDEX = 255


def _to_paletted(frames: list[Image.Image]) -> list[Image.Image]:
    """Map every frame through ONE palette, reserving an index for transparency."""
    w, h = frames[0].size
    strip = Image.new("RGB", (w * len(frames), h))
    for i, frame in enumerate(frames):
        strip.paste(frame.convert("RGB"), (i * w, 0))
    pal_src = strip.quantize(colors=TRANSPARENT_INDEX, dither=Image.NONE)

    out = []
    for frame in frames:
        p = frame.convert("RGB").quantize(palette=pal_src, dither=Image.NONE)
        # everything that was see-through becomes the reserved index
        p.paste(TRANSPARENT_INDEX,
                frame.getchannel("A").point(lambda v: 255 if v < 128 else 0))
        out.append(p)
    return out


def write_gif(sources: list[Path], dest: Path, fps: int, scale: int = 4,
              loop: bool = True) -> Path | None:
    """Write one looping GIF from a list of same-sized frame PNGs.

    Returns None when no frame exists yet, so a caller can ask for a preview of
    something half-built without having to check first.
    """
    paths = [p for p in sources if p.exists()]
    if not paths:
        return None

    frames = [Image.open(p).convert("RGBA") for p in paths]
    # A clip whose frames disagree on size cannot be a GIF; pad to the largest
    # rather than refusing, since the frames stay registered to their top-left.
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    if any(f.size != (w, h) for f in frames):
        padded = []
        for f in frames:
            canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            canvas.paste(f, (0, 0))
            padded.append(canvas)
        frames = padded

    if scale > 1:
        frames = [f.resize((f.width * scale, f.height * scale), Image.NEAREST)
                  for f in frames]

    paletted = _to_paletted(frames)
    dest.parent.mkdir(parents=True, exist_ok=True)
    paletted[0].save(
        dest, save_all=True, append_images=paletted[1:],
        duration=round(1000 / max(1, fps)), loop=0 if loop else 1,
        transparency=TRANSPARENT_INDEX, disposal=2, optimize=False,
    )
    return dest

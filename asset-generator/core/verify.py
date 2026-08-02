"""Check the built atlas against its JSON before anything downstream trusts it."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from .pack import Rect


def verify(dist: Path) -> list[str]:
    """Return a list of problems; empty means the atlas is sound."""
    problems: list[str] = []

    atlas_path, json_path = dist / "atlas.png", dist / "atlas.json"
    for path in (atlas_path, json_path):
        if not path.exists():
            return [f"missing {path}"]

    atlas = Image.open(atlas_path).convert("RGBA")
    doc = json.loads(json_path.read_text())
    frames = doc["frames"]
    meta_size = (doc["meta"]["size"]["w"], doc["meta"]["size"]["h"])

    if atlas.size != meta_size:
        problems.append(f"meta.size {meta_size} != actual atlas size {atlas.size}")
    if not frames:
        problems.append("atlas has no frames")

    rects: list[tuple[str, Rect]] = []
    for name, entry in sorted(frames.items()):
        f = entry["frame"]
        rect = Rect(f["x"], f["y"], f["w"], f["h"])
        rects.append((name, rect))

        if rect.w <= 0 or rect.h <= 0:
            problems.append(f"{name}: degenerate frame {rect}")
        if rect.x < 0 or rect.y < 0 or rect.right > atlas.width or rect.bottom > atlas.height:
            problems.append(f"{name}: frame {rect} falls outside the atlas {atlas.size}")
            continue

        region = atlas.crop((rect.x, rect.y, rect.right, rect.bottom))
        if region.getchannel("A").getbbox() is None:
            problems.append(f"{name}: frame region is entirely transparent")

        sss, src = entry["spriteSourceSize"], entry["sourceSize"]
        if sss["x"] + rect.w > src["w"] or sss["y"] + rect.h > src["h"]:
            problems.append(f"{name}: trimmed region sticks out of sourceSize {src}")

    for i, (name_a, a) in enumerate(rects):
        for name_b, b in rects[i + 1:]:
            if a.overlaps(b):
                problems.append(f"{name_a} and {name_b} overlap in the atlas")

    return problems

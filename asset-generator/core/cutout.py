"""Stage 2a: extract alpha from the chroma-key background.

Delegates to the helper bundled with codex's imagegen skill. That file is marked
"never modify" by its own SKILL.md, so it is read and executed, never edited.

It used to be run as `uv run --with pillow python remove_chroma_key.py`, which
meant a packaged build still needed uv and a network fetch of Pillow on the
user's machine to get past stage two. The script imports nothing but PIL and the
standard library, and Pillow is already here — so it runs in this process
instead, through `runpy`, and the whole external toolchain drops away.
"""

from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path
from typing import Callable

from .spec import Asset

CODEX_HOME = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
REMOVE_CHROMA_KEY = CODEX_HOME / "skills/.system/imagegen/scripts/remove_chroma_key.py"


FLOOD_TOLERANCE = 12


def _flood_cut(asset: Asset) -> None:
    """Erase the background by flooding inward from the border.

    For hand-supplied art the flat field is often ordinary white, only a few
    steps away from the highlights on the subject. A hue test cannot tell those
    apart and eats both. A flood can: it only removes what is actually connected
    to the edge, so an enclosed near-white highlight survives because the closed
    outline around the subject stops the fill from reaching it.
    """
    from PIL import Image, ImageChops, ImageDraw

    img = Image.open(asset.raw).convert("RGB")

    # a sentinel the art does not already contain, so the mask below cannot
    # accidentally punch a hole in the subject
    present = {colour for _, colour in (img.getcolors(maxcolors=1 << 24) or [])}
    mark = next(c for c in ((255, 0, 255), (254, 0, 254), (255, 0, 254))
                if c not in present)

    for corner in ((0, 0), (img.width - 1, 0),
                   (0, img.height - 1), (img.width - 1, img.height - 1)):
        ImageDraw.floodfill(img, corner, mark, thresh=FLOOD_TOLERANCE)

    # 0 only where all three channels equal the sentinel; 255 everywhere else
    bands = [band.point(lambda v, m=m: 0 if v == m else 255)
             for band, m in zip(img.split(), mark)]
    keep = ImageChops.lighter(ImageChops.lighter(bands[0], bands[1]), bands[2])

    out = img.convert("RGBA")
    out.putalpha(keep)
    out.save(asset.cut)


def cutout(asset: Asset, warn: Callable[[str], None] | None = None) -> None:
    if not asset.raw.exists():
        raise RuntimeError(f"{asset.id}: no raw image yet; generate it first")
    asset.cut.parent.mkdir(parents=True, exist_ok=True)

    if asset.background == "opaque":
        # Nothing to remove, and --auto-key border would sample the material
        # itself and punch holes in it.
        from PIL import Image

        Image.open(asset.raw).convert("RGBA").save(asset.cut)
        return

    if asset.background == "flood":
        _flood_cut(asset)
        _check_survived(asset, warn)
        return

    if not REMOVE_CHROMA_KEY.exists():
        raise FileNotFoundError(
            f"codex's remove_chroma_key.py not found at {REMOVE_CHROMA_KEY}. "
            "Set CODEX_HOME or reinstall codex."
        )

    _run_chroma_script([
        str(REMOVE_CHROMA_KEY),
        "--input", str(asset.raw),
        "--out", str(asset.cut),
        # Sample the border rather than trusting the requested key color: the
        # model never returns exactly #00ff00.
        "--auto-key", "border",
        "--soft-matte",
        "--transparent-threshold", str(asset.transparent_threshold),
        "--opaque-threshold", str(asset.opaque_threshold),
        "--despill",
        "--force",
    ])
    _check_survived(asset, warn)


def _run_chroma_script(argv: list[str]) -> None:
    """Execute the helper as if it had been launched with `argv`.

    It reads `sys.argv` through argparse and ends by calling `main()` under an
    `if __name__ == "__main__"` guard, so it needs both swapped in — and it exits
    through `SystemExit`, which here is a return value rather than the end of the
    program.
    """
    original = sys.argv
    sys.argv = argv
    try:
        runpy.run_path(argv[0], run_name="__main__")
    except SystemExit as exit_call:
        if exit_call.code:
            raise RuntimeError(
                f"remove_chroma_key.py 가 {exit_call.code} 로 종료했습니다."
            ) from exit_call
    finally:
        sys.argv = original


# Opaque pixels as a share of the alpha bounding box. Measured across the
# current assets a healthy cutout sits at 38-72%; a green sparkle keyed out
# against a green background came in at 18%, because what survived was scattered
# across the full frame instead of being a solid subject.
SPARSE_FILL = 0.25


def _check_survived(asset: Asset, warn: Callable[[str], None] | None) -> None:
    """Warn when the subject shared the key colour and got partly keyed out.

    Coverage alone does not catch this: the key eats the mid-tone body and leaves
    the highlights and dark edges, so plenty of pixels remain — just spread thin
    over the whole frame, to be lost at the alpha threshold on the way down to
    32px. It is otherwise a silent failure that pixelizes and packs without
    complaint. A warning rather than an error, because a sparse effect — a ring
    of shards, a spray — is legitimately thin too.
    """
    from PIL import Image

    alpha = Image.open(asset.cut).convert("RGBA").getchannel("A")
    box = alpha.getbbox()
    if box is None:
        raise RuntimeError(f"{asset.id}: background removal left nothing at all")
    opaque = sum(1 for v in alpha.tobytes() if v)
    fill = opaque / ((box[2] - box[0]) * (box[3] - box[1]))
    if fill >= SPARSE_FILL or warn is None:
        return
    warn(
        f"{asset.id}: 자기 바운딩 박스의 {fill:.0%}만 불투명합니다. "
        f"피사체가 key_color={asset.key_color} 에 가까운 색을 쓰면 키가 피사체 일부까지 "
        f"지웁니다. 다른 키 색(예: #ff00ff)으로 바꿔 다시 생성해 보세요. "
        f"원래 얇거나 성긴 형태라면 무시해도 됩니다."
    )

"""The pipeline as callable steps, so a UI can run one stage and show the result.

`run.py` in the old asset-pipeline did all of this too, but as one batch command
that printed as it went. Here each stage is a function that returns what it did
and reports progress through `on_log`, because the point of the app is to stop
between stages and look at the intermediate file.

Stage order for one asset:

    generate -> cutout -> pixelize -> rig      (inside the asset's own directory)
    pack -> tiles -> verify                    (whole-project, writes dist/)

Everything after generate is deterministic, so re-running the tail is always
cheap and safe. Only the project-wide build/export stages touch dist/.
"""

from __future__ import annotations

import json
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from . import atlas_json, cutout, generate as generate_mod, pack as pack_mod
from . import rig as rig_mod, spec as spec_mod, tile as tile_mod, verify as verify_mod
from .pixelize import pixelize as pixelize_image
from .spec import ROOT, Asset

DIST = ROOT / "dist"
Logger = Callable[[str], None]

# A tile that does not wrap looks fine on its own and only fails once the game
# repeats it, so the seam has to be caught here. The ratio is the wrap step over
# the average interior step; <= this reads as seamless.
SEAM_LIMIT = 2.0


# --------------------------------------------------------------------------
# loading
# --------------------------------------------------------------------------

def load() -> tuple[dict, list[Asset]]:
    """Config plus every asset on disk, in spec-file order."""
    config = spec_mod.load_config()
    return config, spec_mod.load_specs(config, spec_mod.spec_paths())


def load_manifest(asset: Asset) -> dict:
    """What this asset was last generated from. Lives beside it, not centrally,
    so removing an asset is removing its directory and nothing else."""
    if asset.manifest_file.exists():
        return json.loads(asset.manifest_file.read_text())
    return {}


def save_manifest(asset: Asset, record: dict) -> None:
    asset.manifest_file.parent.mkdir(parents=True, exist_ok=True)
    asset.manifest_file.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n")


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    h = value.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# --------------------------------------------------------------------------
# where files land
# --------------------------------------------------------------------------

def sprite_path(asset: Asset, frame_index: int) -> Path:
    """Where pixelize wrote a given frame of an asset."""
    if not asset.animated:
        return asset.pixel
    return asset.pixel.with_name(f"{asset.pixel.stem}_{frame_index:03d}.png")


def clip_path(asset: Asset, clip: dict, frame_index: int) -> Path:
    return asset.pixel.with_name(f"{asset.pixel.stem}_{clip['name']}_{frame_index:03d}.png")


def sheet_frames(asset: Asset) -> list[tuple[str, Path]]:
    return list(zip(asset.frame_names(), (sprite_path(asset, i) for i in range(asset.frames))))


def clip_frames(asset: Asset, clip: dict) -> list[tuple[str, Path]]:
    paths = (clip_path(asset, clip, i) for i in range(len(clip["frames"])))
    return list(zip(asset.clip_frame_names(clip), paths))


# --------------------------------------------------------------------------
# state, for the library screen
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class State:
    has_raw: bool
    has_pixel: bool          # every sheet frame present
    rigged_clips: tuple      # clip names whose every frame is on disk
    stale: bool              # the prompt changed since raw.png was generated


def state(asset: Asset) -> State:
    has_pixel = all(p.exists() for _, p in sheet_frames(asset))
    rigged = tuple(c["name"] for c in asset.clips
                   if all(p.exists() for _, p in clip_frames(asset, c)))
    stale = False
    if not asset.imported and asset.raw.exists():
        recorded = load_manifest(asset).get("prompt_hash")
        # An asset generated before the manifest existed has nothing to compare
        # against; calling that "changed" would nag about every old asset.
        if recorded is not None:
            from . import prompt as prompt_mod
            stale = recorded != spec_mod.prompt_hash(prompt_mod.build(asset))
    return State(asset.raw.exists(), has_pixel, rigged, stale)


def referrers(asset: Asset, all_assets: list[Asset]) -> list[Asset]:
    """Assets that would break if this one were deleted."""
    return [a for a in all_assets
            if a.id != asset.id
            and asset.id in (a.reference_from, a.palette_from)]


# --------------------------------------------------------------------------
# stage 1: generate
# --------------------------------------------------------------------------

def write_reference(asset: Asset, all_assets: list[Asset]) -> None:
    """Put one clean frame of the donor's raw art where the prompt says it is.

    A sheet is cropped to its first cell: the model is being shown what the
    character looks like, and four cells of it invites copying the old poses too.
    """
    if not asset.reference_from:
        return
    from PIL import Image

    donor = next(a for a in all_assets if a.id == asset.reference_from)
    if not donor.raw.exists():
        raise RuntimeError(
            f"{asset.id}: needs {donor.id} as a reference, but "
            f"{donor.raw.relative_to(ROOT)} does not exist. Generate {donor.id} first."
        )
    img = Image.open(donor.raw)
    if donor.animated:
        img = img.crop((0, 0, img.width // donor.cols, img.height // donor.rows))
    donor.ref_image.parent.mkdir(parents=True, exist_ok=True)
    img.save(donor.ref_image)


async def run_generate(asset: Asset, all_assets: list[Asset], config: dict,
                       on_log: Logger | None = None,
                       edit_request: str | None = None) -> None:
    """Draw (or redraw) this asset's raw.png.

    An edit skips the reference preparation: it is anchored to the asset's own
    current art, which is already on disk.
    """
    if asset.imported:
        raise RuntimeError(f"{asset.id}: marked imported — its raw.png is supplied by hand")
    if not edit_request:
        write_reference(asset, all_assets)

    text = await generate_mod.generate(asset, config, on_log, edit_request)
    save_manifest(asset, {
        "prompt_hash": spec_mod.prompt_hash(text),
        "size": asset.size,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        **({"edit_request": edit_request} if edit_request else {}),
    })


# --------------------------------------------------------------------------
# stage 2a: cutout
# --------------------------------------------------------------------------

def run_cutout(asset: Asset, on_log: Logger | None = None) -> list[str]:
    """Separate the subject from its background. Returns any warnings raised."""
    warnings: list[str] = []
    cutout.cutout(asset, warn=warnings.append)
    for note in warnings:
        if on_log:
            on_log(note)
    return warnings


# --------------------------------------------------------------------------
# stage 2b: pixelize
# --------------------------------------------------------------------------

def load_palette(asset: Asset, all_assets: list[Asset]) -> list[tuple[int, int, int]] | None:
    """The donor palette for an asset, or None when it median-cuts its own."""
    if not asset.palette_from:
        return None
    donor = next(a for a in all_assets if a.id == asset.palette_from)
    if not donor.palette_file.exists():
        raise RuntimeError(
            f"{asset.id}: needs {donor.id}'s palette, but "
            f"{donor.palette_file.relative_to(ROOT)} does not exist. "
            f"Pixelize {donor.id} first."
        )
    return [tuple(c) for c in json.loads(donor.palette_file.read_text())]


def run_pixelize(asset: Asset, all_assets: list[Asset], config: dict) -> list[Path]:
    """Downscale, quantize and outline. Returns the sprite paths written."""
    if not asset.cut.exists():
        raise RuntimeError(f"{asset.id}: no cut-out image yet; run cutout first")

    preview_scale = config.get("pixel", {}).get("preview_scale", 8)
    written, used = pixelize_image(
        src=asset.cut,
        dst=asset.pixel,
        size=asset.size,
        colors=asset.colors,
        alpha_threshold=asset.alpha_threshold,
        outline=1.0,
        add_outline_width=asset.outline_width,
        outline_color=hex_to_rgb(asset.outline_color),
        preview_scale=preview_scale,
        rows=asset.rows,
        cols=asset.cols,
        align=asset.align,
        palette=load_palette(asset, all_assets),
        fit=asset.fit,
    )
    asset.palette_file.write_text(json.dumps([list(c) for c in used]))
    return written


# --------------------------------------------------------------------------
# stage 2c: rig
# --------------------------------------------------------------------------

def run_rig(asset: Asset, config: dict, only: str | None = None) -> dict[str, list[Path]]:
    """Compose the asset's rig clips from its first pixel frame.

    `only` limits the run to one clip by name; the rest keep whatever is on disk.
    """
    from PIL import Image

    if not asset.rigged:
        return {}
    base_path = sprite_path(asset, 0)
    if not base_path.exists():
        raise RuntimeError(f"{asset.id}: no pixel sprite yet; run pixelize first")

    base = Image.open(base_path).convert("RGBA")
    for name, box in asset.parts.items():
        if box[2] > base.width or box[3] > base.height:
            raise RuntimeError(
                f"{asset.id}: part {name!r} rectangle {box} falls outside the "
                f"{base.width}x{base.height} sprite"
            )

    preview_scale = config.get("pixel", {}).get("preview_scale", 8)
    written: dict[str, list[Path]] = {}
    for clip in asset.clips:
        if only and clip["name"] != only:
            continue
        paths = []
        for i, frame in enumerate(rig_mod.render_clip(base, asset.parts, clip["frames"])):
            path = clip_path(asset, clip, i)
            frame.save(path)
            paths.append(path)
            if preview_scale > 1:
                frame.resize((frame.width * preview_scale,) * 2, Image.NEAREST) \
                     .save(path.with_name(f"{path.stem}@{preview_scale}x.png"))
        written[clip["name"]] = paths
    return written


# --------------------------------------------------------------------------
# stage 3: pack, tiles, verify — the only stages that write dist/
# --------------------------------------------------------------------------

def build_atlas(all_assets: list[Asset], config: dict) -> dict:
    """Pack every asset that has a pixel sprite — an atlas is all-or-nothing.

    Standalone assets (tiles and backgrounds) are skipped: they ship as their
    own textures.
    """
    sources: list[tuple[str, Path]] = []
    have: set[str] = set()
    for asset in (a for a in all_assets if not a.standalone):
        frames = sheet_frames(asset)
        if all(p.exists() for _, p in frames):
            sources.extend(frames)
            have.update(n for n, _ in frames)
        for clip in asset.clips:
            frames = clip_frames(asset, clip)
            if all(p.exists() for _, p in frames):
                sources.extend(frames)
                have.update(n for n, _ in frames)

    # only advertise an animation whose every frame actually made it in
    anims = [a for asset in all_assets if not asset.standalone
             for a in asset.animations() if all(n in have for n in a["frames"])]

    if not sources:
        raise RuntimeError("nothing to pack; pixelize at least one asset first")

    # Frame keys land in a JSON object, so a collision would silently drop a
    # sprite rather than fail. Catch it here, where the source paths are known.
    seen: dict[str, Path] = {}
    for name, path in sources:
        if name in seen:
            raise RuntimeError(
                f"frame name collision: {name!r} is produced by both "
                f"{seen[name].relative_to(ROOT)} and {path.relative_to(ROOT)}. "
                f"Rename one of the assets or rig clips."
            )
        seen[name] = path

    keys = [a["key"] for asset in all_assets if not asset.standalone
            for a in asset.animations()]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        raise RuntimeError(f"animation key collision: {', '.join(dupes)}")

    atlas_cfg = config.get("atlas", {})
    atlas, frames = pack_mod.pack(
        sources,
        extrude=atlas_cfg.get("extrude", 1),
        padding=atlas_cfg.get("padding", 2),
    )

    DIST.mkdir(parents=True, exist_ok=True)
    atlas.save(DIST / "atlas.png")
    atlas_json.write(frames, atlas.size, DIST)
    atlas_json.write_types(frames, DIST)
    anims.sort(key=lambda a: a["key"])
    atlas_json.write_animations(anims, DIST)
    atlas_json.write_anim_types(anims, DIST)

    used = sum(f.rect.w * f.rect.h for f in frames)
    return {
        "frames": len(frames),
        "size": atlas.size,
        "fill": 100 * used / (atlas.width * atlas.height),
        "anims": [{"key": a["key"], "frames": len(a["frames"]), "fps": a["fps"]}
                  for a in anims],
    }


@dataclass(frozen=True)
class TileReport:
    id: str
    size: int
    horizontal: float
    vertical: float

    @property
    def ok(self) -> bool:
        return max(self.horizontal, self.vertical) <= SEAM_LIMIT


def check_tiles(all_assets: list[Asset]) -> list[TileReport]:
    """Copy standalone textures to dist/tiles/ and check that they really tile."""
    tiles = [a for a in all_assets if a.category == "tile" and a.pixel.exists()]
    if not tiles:
        return []

    out = DIST / "tiles"
    out.mkdir(parents=True, exist_ok=True)
    reports = []
    for asset in sorted(tiles, key=lambda a: a.id):
        dest = out / f"{asset.id}.png"
        shutil.copyfile(asset.pixel, dest)
        h, v = tile_mod.seam_ratios(dest)
        reports.append(TileReport(asset.id, asset.size, h, v))

    names = "\n".join(f"  | {json.dumps(r.id)}" for r in reports)
    types = DIST / "atlas.d.ts"
    if types.exists():
        types.write_text(types.read_text() + "\nexport type TileTexture =\n" + names + ";\n")
    return reports


def export_backgrounds(all_assets: list[Asset]) -> list[Path]:
    """Copy full-screen background textures to dist/backgrounds/."""
    backgrounds = [a for a in all_assets
                   if a.category == "background" and a.pixel.exists()]
    if not backgrounds:
        return []

    out = DIST / "backgrounds"
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for asset in sorted(backgrounds, key=lambda a: a.id):
        dest = out / f"{asset.id}.png"
        shutil.copyfile(asset.pixel, dest)
        written.append(dest)

    names = "\n".join(f"  | {json.dumps(path.stem)}" for path in written)
    types = DIST / "atlas.d.ts"
    if types.exists():
        types.write_text(types.read_text() +
                         "\nexport type BackgroundTexture =\n" + names + ";\n")
    return written


def verify_atlas() -> list[str]:
    """Problems with the built atlas; empty means it is sound."""
    return verify_mod.verify(DIST)

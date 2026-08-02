"""Load pipeline config and asset specs, merging defaults into flat Asset records.

One asset is one directory: `assets/<category>/<id>/asset.toml` plus everything
the pipeline derives from it. The path carries the identity — the category is the
parent folder and the id is the folder name — so a spec file cannot disagree with
where it lives, and deleting an asset is deleting a directory.
"""

from __future__ import annotations

import hashlib
import tomllib
from dataclasses import dataclass, replace
from pathlib import Path

from .paths import ROOT

ASSETS = ROOT / "assets"
CATEGORIES = ("character", "icon", "effect", "prop", "tile")
SPEC_NAME = "asset.toml"
# A tile has to stay its own texture: GPU repeat wrapping needs one, and pack.py
# extrudes every sprite by a pixel, which would smear the seam it must not have.
STANDALONE = ("tile",)

# Keys an [[asset]] block may override; everything else comes from pipeline.toml.
OVERRIDABLE = (
    "size", "key_color", "transparent_threshold", "opaque_threshold",
    "value_steps", "facing", "colors", "alpha_threshold", "outline_width",
    "outline_color", "fps", "repeat", "align", "background", "fit",
)
ALIGN_MODES = ("none", "center-x", "bottom-center")
FIT_MODES = ("contain", "bottom", "fill")
# How the subject is separated from what is behind it.
#   chroma  generated on a flat key colour, removed by hue
#   flood   hand-supplied art on a flat field, removed from the border inward
#   opaque  no background at all; the image is the subject, edge to edge
BACKGROUNDS = ("chroma", "flood", "opaque")


@dataclass(frozen=True)
class Asset:
    id: str
    category: str
    subject: str
    size: int
    key_color: str
    transparent_threshold: int
    opaque_threshold: int
    value_steps: int
    facing: str
    colors: int
    alpha_threshold: int
    outline_width: int
    outline_color: str
    fps: int
    repeat: int
    align: str
    background: str
    fit: str
    rows: int
    cols: int
    motion: str
    parts: dict           # part name -> (x0, y0, x1, y1) in the pixel sprite
    clips: tuple          # rig clips, each {name, fps, repeat, frames}
    imported: bool        # raw.png is supplied by hand; never generated
    palette_from: str     # asset id whose palette this one quantizes against
    reference_from: str   # asset id whose art is shown to the model as the character sheet
    reference_file: str   # a reference image supplied from outside, relative to `dir`
    group: str            # the character these views belong to; "" for a lone asset
    dir: Path             # assets/<category>/<id>; everything below is derived from it
    reference_image: Path | None = None   # resolved from reference_from/_file after load

    @property
    def frames(self) -> int:
        return self.rows * self.cols

    @property
    def animated(self) -> bool:
        return self.frames > 1

    @property
    def rigged(self) -> bool:
        return bool(self.parts and self.clips)

    @property
    def standalone(self) -> bool:
        """Shipped as its own texture rather than packed into the atlas."""
        return self.category in STANDALONE

    def frame_names(self) -> list[str]:
        """Atlas frame keys for the sheet itself; a still keeps its bare id."""
        if not self.animated:
            return [self.id]
        return [f"{self.id}_{i:03d}" for i in range(self.frames)]

    def clip_frame_names(self, clip: dict) -> list[str]:
        return [f"{self.id}_{clip['name']}_{i:03d}" for i in range(len(clip["frames"]))]

    def animations(self) -> list[dict]:
        """Every playable animation this asset contributes to the atlas."""
        anims = []
        if self.animated:
            anims.append({"key": self.id, "frames": self.frame_names(),
                          "fps": self.fps, "repeat": self.repeat})
        for clip in self.clips:
            anims.append({"key": f"{self.id}_{clip['name']}",
                          "frames": self.clip_frame_names(clip),
                          "fps": clip["fps"], "repeat": clip["repeat"]})
        return anims

    @property
    def spec_file(self) -> Path:
        return self.dir / SPEC_NAME

    @property
    def manifest_file(self) -> Path:
        """What this asset was last generated from, so `generate` can skip it."""
        return self.dir / "manifest.json"

    @property
    def raw(self) -> Path:
        return self.dir / "raw.png"

    @property
    def work(self) -> Path:
        return self.dir / "work"

    @property
    def cut(self) -> Path:
        return self.work / "cut.png"

    @property
    def prompt_file(self) -> Path:
        return self.work / "prompt.txt"

    @property
    def events_file(self) -> Path:
        return self.work / "events.jsonl"

    @property
    def last_file(self) -> Path:
        return self.work / "last.txt"

    @property
    def palette_file(self) -> Path:
        """The art palette this asset quantized to, for another asset to borrow."""
        return self.work / "palette.json"

    @property
    def ref_image(self) -> Path:
        """One clean frame of this asset's raw art, shown to the model as a reference."""
        return self.work / "ref.png"

    @property
    def external_ref(self) -> Path:
        """Where a reference image supplied from outside is copied to.

        codex runs sandboxed with cwd=ROOT, so it cannot open a file elsewhere on
        the disk — an attached reference has to be brought into the tree first.
        """
        return self.work / "ref_external.png"

    @property
    def candidates(self) -> Path:
        """Every version ever generated for this asset, one numbered directory
        each. `raw.png` is a copy of whichever one was adopted, so re-adopting an
        earlier take never costs another model call."""
        return self.dir / "candidates"

    @property
    def pixel(self) -> Path:
        """Sprite files keep the id in their name so a file stem is a frame key."""
        return self.dir / "pixel" / f"{self.id}.png"


def load_config(path: Path | None = None) -> dict:
    path = path or ROOT / "pipeline.toml"
    with path.open("rb") as fh:
        return tomllib.load(fh)


def _defaults_for(config: dict, category: str) -> dict:
    """Flatten the config sections that an asset can draw from or override."""
    merged: dict = {}
    merged.update(config.get("chroma", {}))
    merged.update(config.get("prompt", {}))
    merged.update(config.get("pixel", {}))
    merged.update(config.get("animation", {}))
    merged.update(config.get("category", {}).get(category, {}))
    return {k: v for k, v in merged.items() if k in OVERRIDABLE}


def _parse_rig(rig: dict, path: Path, asset_id: str, fields: dict) -> tuple[dict, tuple]:
    """Validate an [asset.rig] block into (parts, clips)."""
    if not rig:
        return {}, ()

    parts = {}
    for name, box in rig.get("parts", {}).items():
        if name == "body":
            raise ValueError(f"{path}: {asset_id!r} 'body' is reserved — it moves the whole frame")
        if len(box) != 4:
            raise ValueError(f"{path}: {asset_id!r} part {name!r} must be [x0, y0, x1, y1]")
        x0, y0, x1, y1 = (int(v) for v in box)
        if x1 <= x0 or y1 <= y0:
            raise ValueError(f"{path}: {asset_id!r} part {name!r} has an empty rectangle")
        parts[name] = (x0, y0, x1, y1)

    clips = []
    for clip in rig.get("clip", []):
        name = clip.get("name")
        if not name:
            raise ValueError(f"{path}: {asset_id!r} has a rig clip with no name")
        frames = clip.get("frames") or []
        if not frames:
            raise ValueError(f"{path}: {asset_id!r} clip {name!r} has no frames")
        parsed = []
        for i, moves in enumerate(frames):
            for part in moves:
                if part != "body" and part not in parts:
                    raise ValueError(
                        f"{path}: {asset_id!r} clip {name!r} frame {i} moves unknown part "
                        f"{part!r}; defined parts are {sorted(parts) or 'none'}"
                    )
            parsed.append({p: (int(o[0]), int(o[1])) for p, o in moves.items()})
        clips.append({
            "name": name,
            "fps": int(clip.get("fps", fields["fps"])),
            "repeat": int(clip.get("repeat", fields["repeat"])),
            "frames": parsed,
        })

    if clips and not parts:
        raise ValueError(f"{path}: {asset_id!r} defines rig clips but no parts")
    return parts, tuple(clips)


def load_specs(config: dict, paths: list[Path]) -> list[Asset]:
    assets: list[Asset] = []
    seen: dict[str, Path] = {}

    for path in paths:
        directory = path.parent
        asset_id, category = directory.name, directory.parent.name
        if category not in CATEGORIES:
            raise ValueError(
                f"{path}: sits under {category!r}, which is not a category; "
                f"expected assets/<{'|'.join(CATEGORIES)}>/<id>/{SPEC_NAME}"
            )

        with path.open("rb") as fh:
            block = tomllib.load(fh)

        imported = bool(block.get("imported"))
        if not imported and not block.get("subject"):
            raise ValueError(f"{path}: missing 'subject'")
        if asset_id in seen:
            raise ValueError(f"duplicate asset id {asset_id!r} in {path} and {seen[asset_id]}")
        seen[asset_id] = path

        # 'id' and 'category' are deliberately not accepted: the directory says
        # both, and a second copy in the file is a second thing to keep in sync.
        unknown = (set(block) - set(OVERRIDABLE)
                   - {"subject", "layout", "motion", "rig", "group",
                      "palette_from", "reference_from", "reference_file", "imported"})
        if unknown:
            hint = ""
            if unknown & {"id", "category"}:
                hint = (f"  ('id' and 'category' come from the path: "
                        f"assets/{category}/{asset_id}/)")
            raise ValueError(f"{path}: unknown keys {sorted(unknown)}{hint}")

        layout = block.get("layout", {})
        rows, cols = int(layout.get("rows", 1)), int(layout.get("cols", 1))
        if rows < 1 or cols < 1:
            raise ValueError(f"{path}: layout must have rows >= 1 and cols >= 1")
        if rows * cols > 1 and not block.get("motion"):
            raise ValueError(f"{path}: has {rows}x{cols} frames but no 'motion'")

        fields = _defaults_for(config, category)
        fields.update({k: v for k, v in block.items() if k in OVERRIDABLE})
        if fields["align"] not in ALIGN_MODES:
            raise ValueError(
                f"{path}: align={fields['align']!r}; expected one of {ALIGN_MODES}"
            )
        if fields["background"] not in BACKGROUNDS:
            raise ValueError(
                f"{path}: background={fields['background']!r}; expected one of {BACKGROUNDS}"
            )
        if fields["fit"] not in FIT_MODES:
            raise ValueError(
                f"{path}: fit={fields['fit']!r}; expected one of {FIT_MODES}"
            )
        if fields["fit"] == "fill" and rows * cols > 1:
            raise ValueError(
                f"{path}: fit='fill' scales the whole image onto one canvas, so it "
                f"cannot slice a {rows}x{cols} sheet. Drop 'layout' or use another fit."
            )

        parts, clips = _parse_rig(block.get("rig", {}), path, asset_id, fields)

        assets.append(Asset(
            id=asset_id,
            category=category,
            subject=block.get("subject", "").strip(),
            imported=imported,
            motion=block.get("motion", "").strip(),
            rows=rows,
            cols=cols,
            parts=parts,
            clips=clips,
            palette_from=block.get("palette_from", "").strip(),
            reference_from=block.get("reference_from", "").strip(),
            reference_file=block.get("reference_file", "").strip(),
            group=block.get("group", "").strip(),
            dir=directory,
            **fields,
        ))

    _check_palette_links(assets, seen)
    return _link_references(assets, seen)


def _link_references(assets: list[Asset], seen: dict[str, Path]) -> list[Asset]:
    """Resolve whichever kind of reference an asset declares into one image path.

    Two kinds exist and they are mutually exclusive. `reference_from` names
    another asset, and the path can only be known once every asset is loaded
    because it lives under the donor's own directory. `reference_file` is art
    that came from outside and was copied into this asset's own work directory.

    A reference donor must exist, must not be the asset itself, and must not
    itself be drawn from a reference — the point is one authoritative drawing,
    and a chain would let the design drift a copy at a time.

    The file is deliberately not checked for existence here: one missing
    attachment should not stop the whole library from loading. Generation
    checks it, which is the only place it actually matters.
    """
    by_id = {a.id: a for a in assets}
    linked = []
    for asset in assets:
        where = seen[asset.id]
        if asset.reference_from and asset.reference_file:
            raise ValueError(
                f"{where}: {asset.id!r} sets both reference_from and reference_file; "
                f"an asset is drawn from one reference or the other, not both"
            )
        if asset.reference_file:
            linked.append(replace(asset, reference_image=asset.dir / asset.reference_file))
            continue
        if not asset.reference_from:
            linked.append(asset)
            continue
        if asset.reference_from == asset.id:
            raise ValueError(f"{where}: {asset.id!r} references itself")
        donor = by_id.get(asset.reference_from)
        if donor is None:
            raise ValueError(
                f"{where}: {asset.id!r} has reference_from={asset.reference_from!r}, "
                f"which is not a known asset id"
            )
        if donor.reference_from:
            raise ValueError(
                f"{where}: {asset.id!r} references {donor.id!r}, which itself references "
                f"{donor.reference_from!r}. Point both at {donor.reference_from!r}."
            )
        linked.append(replace(asset, reference_image=donor.ref_image))
    return linked


def _check_palette_links(assets: list[Asset], seen: dict[str, Path]) -> None:
    """A palette donor must exist and must not itself borrow one.

    Only one hop is allowed. That keeps the donor's palette the single source of
    truth for a character — a chain would let the tones drift one snap at a time
    down the chain, which is the exact problem palette_from exists to stop.
    """
    by_id = {a.id: a for a in assets}
    for asset in assets:
        if not asset.palette_from:
            continue
        where = seen[asset.id]
        if asset.palette_from == asset.id:
            raise ValueError(f"{where}: {asset.id!r} borrows its palette from itself")
        donor = by_id.get(asset.palette_from)
        if donor is None:
            raise ValueError(
                f"{where}: {asset.id!r} has palette_from={asset.palette_from!r}, "
                f"which is not a known asset id"
            )
        if donor.palette_from:
            raise ValueError(
                f"{where}: {asset.id!r} borrows its palette from {donor.id!r}, which "
                f"borrows from {donor.palette_from!r}. Point both at {donor.palette_from!r}."
            )


def spec_paths(assets_dir: Path | None = None) -> list[Path]:
    """Every asset spec, as assets/<category>/<id>/asset.toml."""
    return sorted((assets_dir or ASSETS).glob(f"*/*/{SPEC_NAME}"))


def prompt_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]

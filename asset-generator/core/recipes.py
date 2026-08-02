"""Turn one character description into the five assets that make up a character.

The recipe itself lives in `presets/character.toml`, not here — adding a sixth
animation should be editing a data file, not editing Python. What this module
does is read that file, decide what has to happen in what order, and write the
`asset.toml` files that the rest of the pipeline already knows how to consume.

The result is ordinary spec files. Nothing about an asset made this way is
special afterwards: it can be regenerated, edited, or hand-tuned exactly like one
written by hand, which is the point of generating the spec rather than driving
the pipeline directly.

Order is fixed by one rule: the base view is the character. It is drawn first,
and every other view is generated with the base as its reference and its palette
donor, so the design is settled once. Rig clips come last because they need the
base's finished pixel sprite to cut rectangles out of.
"""

from __future__ import annotations

import textwrap
import tomllib
from dataclasses import dataclass
from pathlib import Path

from .spec import ASSETS, ROOT, SPEC_NAME

PRESETS = ROOT / "presets"
CATEGORY = "character"


# --------------------------------------------------------------------------
# the preset
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Animation:
    name: str
    label: str
    kind: str                     # "sheet" | "rig"
    role: str = ""                # "base" for the view every other one copies
    suffix: str = ""
    # sheet
    rows: int = 1
    cols: int = 1
    align: str = ""
    facing: str = ""
    motion: str = ""
    view_note: str = ""
    # rig
    target: str = ""
    clip: str = ""
    needs_parts: tuple = ()
    frames: tuple = ()
    # both
    fps: int = 0
    repeat: int | None = None

    @property
    def is_base(self) -> bool:
        return self.role == "base"

    def asset_id(self, group: str) -> str:
        """A rig clip lives inside its target's asset, so it has no id of its own."""
        return group + self.suffix


def load_preset(path: Path | None = None) -> list[Animation]:
    path = path or PRESETS / "character.toml"
    blocks = tomllib.loads(path.read_text())["animation"]
    out = []
    for b in blocks:
        layout = b.get("layout", {})
        out.append(Animation(
            name=b["name"], label=b.get("label", b["name"]), kind=b["kind"],
            role=b.get("role", ""), suffix=b.get("suffix", ""),
            rows=int(layout.get("rows", 1)), cols=int(layout.get("cols", 1)),
            align=b.get("align", ""), facing=b.get("facing", "").strip(),
            motion=b.get("motion", "").strip(), view_note=b.get("view_note", "").strip(),
            target=b.get("target", ""), clip=b.get("clip", ""),
            needs_parts=tuple(b.get("needs_parts", ())),
            frames=tuple(b.get("frames", ())),
            fps=int(b.get("fps", 0)), repeat=b.get("repeat"),
        ))
    if not any(a.is_base for a in out):
        raise ValueError(f"{path}: no animation is marked role = \"base\"")
    return out


def base_of(preset: list[Animation]) -> Animation:
    return next(a for a in preset if a.is_base)


# --------------------------------------------------------------------------
# the plan
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Step:
    """One row of the plan the UI shows before anything runs."""
    animation: Animation
    asset_id: str          # the asset this step produces or writes into
    reference: str         # what it is drawn from, in words, for display


def plan(group: str, preset: list[Animation],
         selected: set[str] | None = None,
         attached_reference: bool = False) -> list[Step]:
    """What will run, in order. `selected` filters by animation name."""
    base = base_of(preset)
    steps = []
    for a in preset:
        if selected is not None and a.name not in selected:
            continue
        if a.kind == "rig":
            target = next(x for x in preset if x.name == a.target)
            steps.append(Step(a, target.asset_id(group),
                              f"{target.label} 스프라이트에서 합성"))
        elif a.is_base:
            steps.append(Step(a, a.asset_id(group),
                              "첨부한 레퍼런스" if attached_reference else "없음 (새로 그림)"))
        else:
            steps.append(Step(a, a.asset_id(group), f"{base.label} 정면"))
    # sheets before rigs regardless of how the preset is ordered: a rig cannot run
    # until the sprite it cuts up exists.
    steps.sort(key=lambda s: (s.animation.kind == "rig", not s.animation.is_base))
    return steps


# --------------------------------------------------------------------------
# writing asset.toml
# --------------------------------------------------------------------------

def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace('"""', '\\"\\"\\"')


def _multiline(text: str, width: int = 78) -> str:
    """A TOML multi-line string wrapped for reading, in the style of the hand-written specs.

    Each wrapped line ends in a backslash so TOML rejoins them into one logical
    line — the model receives one paragraph, the file stays diffable.
    """
    lines = textwrap.wrap(" ".join(_escape(text).split()), width=width) or [""]
    body = " \\\n".join(lines)
    return f'"""\n{body}\\\n"""'


def _scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def _rig_section(parts: dict, clips: list[dict]) -> str:
    """The [rig] block: rectangles of the finished sprite, moved by whole pixels."""
    rects = ", ".join(f"{n} = [{b[0]}, {b[1]}, {b[2]}, {b[3]}]"
                      for n, b in sorted(parts.items()))
    out = [
        "",
        "# Cutout rig: rectangles of the finished pixel sprite, moved by whole pixels.",
        "# Re-check these after a regeneration — the model does not place the",
        "# character identically twice.",
        "[rig]",
        f"parts = {{ {rects} }}",
    ]
    for clip in clips:
        out += ["", "[[rig.clip]]", f'name = "{clip["name"]}"', f'fps = {clip["fps"]}']
        if clip.get("repeat") is not None:
            out.append(f'repeat = {clip["repeat"]}')
        out.append("# Each frame lists the parts that move; anything unnamed stays at rest.")
        out.append("# `body` is reserved and shifts the whole composed frame.")
        out.append("frames = [")
        for moves in clip["frames"]:
            inner = ", ".join(f"{p} = [{o[0]}, {o[1]}]" for p, o in moves.items())
            out.append(f"  {{ {inner} }},")
        out.append("]")
    return "\n".join(out)


def render_spec(*, asset_id: str, category: str = CATEGORY, group: str = "",
                subject: str = "", rows: int = 1, cols: int = 1,
                fps: int | None = None,
                align: str = "", facing: str = "", motion: str = "",
                reference_from: str = "", reference_file: str = "",
                palette_from: str = "", overrides: dict | None = None,
                parts: dict | None = None, clips: list[dict] | None = None,
                note: str = "") -> str:
    """Render an asset.toml. Only keys that carry meaning are written."""
    out = [
        f'# {category} asset "{asset_id}".',
        "#",
        "# Written by asset-generator. Edit it freely — nothing downstream treats a",
        "# generated spec differently from a hand-written one.",
    ]
    if note:
        out += ["#"] + [f"# {line}" for line in textwrap.wrap(note, 74)]
    out.append("")

    if group:
        out.append(f'group = "{group}"')
    if rows * cols > 1:
        out.append(f"layout = {{ rows = {rows}, cols = {cols} }}")
    if fps is not None:
        out.append(f"fps = {fps}")
    for key, value in sorted((overrides or {}).items()):
        out.append(f"{key} = {_scalar(value)}")
    if palette_from:
        out += ["# Quantize against this asset's palette instead of median-cutting a fresh",
                "# one, or the character changes colour between views.",
                f'palette_from = "{palette_from}"']
    if reference_from:
        out += ["# Wording alone does not hold a design. Showing the model the finished",
                "# front view makes that drawing the authority instead of the prose.",
                f'reference_from = "{reference_from}"']
    if reference_file:
        out += ["# Art supplied from outside, copied in so the sandboxed agent can open it.",
                f'reference_file = "{reference_file}"']
    if align:
        out.append(f'align = "{align}"')
    if facing:
        out += ["", "# Overrides the front-view composition line in prompts/character.md.",
                f"facing = {_multiline(facing)}"]
    if motion:
        out += ["", f"motion = {_multiline(motion)}"]
    if subject:
        out += ["", f"subject = {_multiline(subject)}"]
    if parts and clips:
        out.append(_rig_section(parts, clips))
    return "\n".join(out) + "\n"


def write_spec(asset_id: str, text: str, category: str = CATEGORY) -> Path:
    path = ASSETS / category / asset_id / SPEC_NAME
    for sub in ("work", "pixel"):
        (path.parent / sub).mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return path


# --------------------------------------------------------------------------
# the two spec shapes a character needs
# --------------------------------------------------------------------------

def base_subject(subject: str, anim: Animation) -> str:
    """The user's one front-on description, plus what changed about the camera.

    `view_note` never says anything about who the character is — only about which
    parts of it this angle can see — so the same description drives every view.
    """
    subject = subject.strip()
    return f"{subject}\n\n{anim.view_note}".strip() if anim.view_note else subject


def base_spec(group: str, subject: str, anim: Animation,
              overrides: dict | None = None, reference_file: str = "",
              reference_from: str = "",
              parts: dict | None = None, clips: list[dict] | None = None) -> str:
    """The front view: the character itself, and the donor for every other view."""
    return render_spec(
        asset_id=anim.asset_id(group), group=group,
        subject=base_subject(subject, anim),
        rows=anim.rows, cols=anim.cols, fps=anim.fps or None, align=anim.align,
        motion=anim.motion, reference_file=reference_file,
        reference_from=reference_from,
        overrides=overrides, parts=parts, clips=clips,
        note=f"The base view of {group}: every other view is drawn from this one.",
    )


def view_spec(group: str, subject: str, anim: Animation, base: Animation,
              overrides: dict | None = None,
              parts: dict | None = None, clips: list[dict] | None = None) -> str:
    """A view other than the front. Takes a rig block too: a view drawn as a
    single pose carries its own clips, cut from its own sprite."""
    base_id = base.asset_id(group)
    return render_spec(
        asset_id=anim.asset_id(group), group=group,
        subject=base_subject(subject, anim),
        rows=anim.rows, cols=anim.cols, fps=anim.fps or None, align=anim.align,
        facing=anim.facing, motion=anim.motion,
        reference_from=base_id, palette_from=base_id, overrides=overrides,
        parts=parts, clips=clips,
        note=f"The {anim.label} view of {group}.",
    )


def rig_clips(preset: list[Animation], selected: set[str] | None = None) -> dict[str, list[dict]]:
    """Rig clips grouped by the animation whose asset they are composed from.

    Grouped rather than flat because a clip is stored in the spec of the sprite
    it cuts up, and not every rig targets the front view: a standing pose drawn
    once and bounced is a clip on that pose's own asset.
    """
    out: dict[str, list[dict]] = {}
    for a in preset:
        if a.kind != "rig" or (selected is not None and a.name not in selected):
            continue
        out.setdefault(a.target, []).append(
            {"name": a.clip, "fps": a.fps, "repeat": a.repeat,
             "frames": [dict(f) for f in a.frames]}
        )
    return out


def required_parts(preset: list[Animation], target: str,
                   selected: set[str] | None = None) -> list[str]:
    """Part names the selected rig clips move on `target`'s sprite.

    Per target, because the rectangles are measured off one particular sprite:
    the front view's legs say nothing about where the side view's are.
    """
    names: list[str] = []
    for a in preset:
        if a.kind != "rig" or a.target != target:
            continue
        if selected is not None and a.name not in selected:
            continue
        for part in a.needs_parts:
            if part not in names:
                names.append(part)
    return names

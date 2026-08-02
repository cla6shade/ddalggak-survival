"""Assemble the final codex prompt for an asset from the shared templates."""

from __future__ import annotations

from .spec import ROOT, Asset

PROMPTS = ROOT / "prompts"

# codex is told to do one thing and nothing else; anything looser and the agent
# starts writing helper scripts instead of just generating the image.
HEADER = """\
Use the built-in `image_gen` tool exactly ONE time to generate the image specified \
below, then copy the resulting file to `{dest}` inside the current working directory. \
Do nothing else: do not write code, do not create other files, do not edit anything. \
When finished, report the absolute path of the file you copied.

Image specification:
"""

# The built-in image_gen tool can only use a reference that is already in the
# conversation, so a file on disk has to be opened with view_image first.
HEADER_REF = """\
First use the built-in `view_image` tool to open `{ref}` and study it carefully. \
Then use the built-in `image_gen` tool exactly ONE time to generate the image \
specified below, passing that image along as the reference, and copy the resulting \
file to `{dest}` inside the current working directory. Do nothing else: do not write \
code, do not create other files, do not edit anything. When finished, report the \
absolute path of the file you copied.

Image specification:
"""


# What the detail budget forbids. A cut-out sprite wants no surface detail at
# all; a floor material is nothing BUT surface detail, and the shared list
# happens to ban "seams", which is the one thing a tile has to show.
DETAIL_BAN = (
    "Absolutely no texture, no surface grain, no thin hairs or strands, no wrinkles, "
    "no folds, no seams, no buttons, no small props, no gradients, no glow, no bloom, "
    "no noise, no rendered realism, no anti-aliased soft edges within the subject."
)
DETAIL_BAN_MATERIAL = (
    "The material's own joints, blotches and markings are wanted, but every one of "
    "them must be at least two final pixels thick or it will boil into speckle. "
    "Absolutely no fine surface grain, no fabric weave, no fine speckle, no thin "
    "scratches, no gradients, no glow, no bloom, no photographic noise, no rendered "
    "realism, no anti-aliased soft edges."
)


def _grid_ban(asset: Asset) -> str:
    """What the 'do not include' line adds about grids and repetition."""
    if asset.animated:
        return ", grid lines, cell borders, separators, frame numbers"
    if not asset.background == "chroma":
        return ""          # a tiling material repeats on purpose
    return ", grid, multiple subjects"


def _fill(text: str, values: dict[str, str]) -> str:
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", str(value))
    return text


def build(asset: Asset, edit_request: str | None = None) -> str:
    """Assemble the prompt for an asset.

    With `edit_request`, the asset's own current `raw.png` becomes the reference
    and the brief changes from "draw this" to "change only this". The whole sheet
    is shown rather than one cropped cell — an edit has to keep the frames
    registered to each other, which it cannot do without seeing them.
    """
    values = {
        "subject": asset.subject,
        "motion": asset.motion,
        "size": asset.size,
        "key_color": asset.key_color,
        "value_steps": asset.value_steps,
        "facing": asset.facing,
        "shadow_steps": max(1, asset.value_steps - 1),
        "rows": asset.rows,
        "cols": asset.cols,
        "frames": asset.frames,
        # A sheet legitimately repeats the subject and is legitimately a grid,
        # so the still-image bans have to stand down.
        "frame_scope": "its grid cell" if asset.animated else "the frame",
        # An opaque full-bleed material is not "one subject in a frame", and a
        # repeating floor is made OF a grid — banning one would fight the brief.
        "single_subject": "" if asset.animated or not asset.background == "chroma" else ", single subject",
        "grid_ban": _grid_ban(asset),
        "detail_ban": DETAIL_BAN if asset.background == "chroma" else DETAIL_BAN_MATERIAL,
    }

    # A cut-out asset needs a key colour to remove; an opaque one needs the
    # opposite instruction, or the model leaves a margin the tile cannot have.
    # Filled before insertion: _fill makes a single pass, and this text carries
    # its own {{key_color}} that would otherwise survive it.
    rule = PROMPTS / ("_chroma.md" if asset.background == "chroma" else "_opaque.md")
    values["background_rule"] = _fill(rule.read_text().strip(), values)

    # An edit is anchored to the asset's own current art, so it displaces any
    # reference the spec names — the two briefs contradict each other, one saying
    # "copy this character" and the other "keep this exact drawing".
    reference = asset.raw if edit_request else asset.reference_image
    if edit_request:
        values["edit_request"] = edit_request.strip()

    sections = []
    if asset.animated:
        # The grid contract goes first: it is the constraint the model is most
        # likely to drop, and the rest of the prompt is about a single subject.
        sections.append((PROMPTS / "_sheet.md").read_text())
    if edit_request:
        sections.append((PROMPTS / "_edit.md").read_text())
    elif reference:
        # Before the subject text, so the words are read as describing the
        # drawing the model is looking at rather than as a fresh brief.
        sections.append((PROMPTS / "_reference.md").read_text())
    sections.append((PROMPTS / f"{asset.category}.md").read_text())
    sections.append((PROMPTS / "_base.md").read_text())

    dest = asset.raw.relative_to(ROOT).as_posix()
    if reference:
        ref = reference.relative_to(ROOT).as_posix()
        values["reference"] = ref
        header = HEADER_REF.format(dest=dest, ref=ref)
    else:
        header = HEADER.format(dest=dest)
    parts = [header] + [_fill(s, values) for s in sections]
    prompt = "\n".join(part.strip() for part in parts) + "\n"

    leftover = [tok for tok in ("{{",) if tok in prompt]
    if leftover:
        raise ValueError(f"{asset.id}: prompt still has unsubstituted placeholders")
    return prompt

"""Every version of an asset's raw art that was ever generated, kept side by side.

A model call is slow and never repeats itself, so throwing away the previous take
the moment a new one lands is the one irreversible thing this pipeline does. Each
generation is snapshotted into its own numbered directory instead, and `raw.png`
is a copy of whichever one is currently adopted. Re-adopting an earlier take is
then a file copy rather than another call.

    assets/<category>/<id>/
      raw.png              <- a copy of the adopted candidate
      candidates/
        001/ raw.png prompt.txt meta.json
        002/ ...

Numbering comes from scanning the directory, not from a clock, so the same
sequence of actions always produces the same names.
"""

from __future__ import annotations

import json
import shutil
import time
from dataclasses import dataclass
from pathlib import Path

from .spec import Asset

META = "meta.json"
RAW = "raw.png"
PROMPT = "prompt.txt"


@dataclass(frozen=True)
class Candidate:
    n: int
    dir: Path
    source: str          # "generate" | "edit" | "imported"
    note: str            # the edit request, or whatever the caller labelled it
    created_at: str
    prompt_hash: str

    @property
    def raw(self) -> Path:
        return self.dir / RAW

    @property
    def prompt_file(self) -> Path:
        return self.dir / PROMPT

    @property
    def label(self) -> str:
        return f"#{self.n:03d} {self.note}" if self.note else f"#{self.n:03d}"


def list_candidates(asset: Asset) -> list[Candidate]:
    """Every snapshot for an asset, oldest first."""
    root = asset.candidates
    if not root.is_dir():
        return []
    out = []
    for directory in sorted(root.iterdir()):
        if not directory.is_dir() or not (directory / RAW).exists():
            continue
        try:
            n = int(directory.name)
        except ValueError:
            continue
        meta = {}
        if (directory / META).exists():
            try:
                meta = json.loads((directory / META).read_text())
            except json.JSONDecodeError:
                pass
        out.append(Candidate(
            n=n, dir=directory,
            source=meta.get("source", "generate"),
            note=meta.get("note", ""),
            created_at=meta.get("created_at", ""),
            prompt_hash=meta.get("prompt_hash", ""),
        ))
    return out


def _next_number(asset: Asset) -> int:
    existing = [c.n for c in list_candidates(asset)]
    return max(existing, default=0) + 1


def snapshot(asset: Asset, source: str = "generate", note: str = "",
             prompt_hash: str = "") -> Candidate | None:
    """Copy the asset's current raw art into a new numbered candidate.

    Returns None when there is nothing to snapshot yet. Call this *before* a
    generate that would overwrite `raw.png` — an edit in particular uses the same
    file as both its reference and its destination.
    """
    if not asset.raw.exists():
        return None

    n = _next_number(asset)
    directory = asset.candidates / f"{n:03d}"
    directory.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(asset.raw, directory / RAW)
    if asset.prompt_file.exists():
        shutil.copyfile(asset.prompt_file, directory / PROMPT)
    meta = {
        "source": source,
        "note": note,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "prompt_hash": prompt_hash,
    }
    (directory / META).write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    return Candidate(n, directory, source, note, meta["created_at"], prompt_hash)


def adopt(asset: Asset, n: int) -> Path:
    """Make candidate `n` the asset's current raw art.

    Everything downstream — cutout, pixelize, rig — has to be re-run afterwards,
    which is the caller's job: this function only moves one file, so that a
    mistaken adoption is undone by adopting the other one back.
    """
    candidate = next((c for c in list_candidates(asset) if c.n == n), None)
    if candidate is None:
        raise RuntimeError(f"{asset.id}: no candidate #{n:03d}")
    shutil.copyfile(candidate.raw, asset.raw)
    if candidate.prompt_file.exists():
        shutil.copyfile(candidate.prompt_file, asset.prompt_file)
    return asset.raw


def adopted(asset: Asset) -> Candidate | None:
    """Which candidate `raw.png` currently matches, if any.

    Compared by bytes rather than tracked in a field: the file is what the rest
    of the pipeline reads, so the file is what decides.
    """
    if not asset.raw.exists():
        return None
    current = asset.raw.read_bytes()
    for candidate in reversed(list_candidates(asset)):
        if candidate.raw.read_bytes() == current:
            return candidate
    return None

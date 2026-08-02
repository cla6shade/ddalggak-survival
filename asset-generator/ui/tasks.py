"""Running pipeline stages from the UI without freezing it.

Two rules hold this together. First, only `generate` is genuinely async — it
waits on a subprocess — while cutout, pixelize and rig are CPU work handed to a
thread with `run.io_bound`, so the event loop keeps serving the page. Second,
nothing here holds an `Asset` across a stage boundary: specs are re-read from
disk between stages, because a stage can change the file the next one reads.
"""

from __future__ import annotations

from pathlib import Path
from typing import Callable

from nicegui import run

from core import anim, history
from core import pipeline as P
from core.spec import Asset

from .state import preview_scale, store

Logger = Callable[[str], None]


def _resolve(asset_id: str) -> Asset:
    store.reload()
    asset = store.by_id(asset_id)
    if asset is None:
        raise RuntimeError(f"{asset_id}: 스펙을 찾을 수 없습니다")
    return asset


async def finish(asset_id: str, on_log: Logger) -> None:
    """The deterministic tail: cutout -> pixelize -> rig.

    Cheap and repeatable, so it always runs whole rather than trying to work out
    what is still valid.
    """
    asset = _resolve(asset_id)

    on_log("배경 분리 중…")
    warnings = await run.io_bound(P.run_cutout, asset)
    for note in warnings:
        on_log(f"경고: {note}")

    on_log("픽셀화 중…")
    written = await run.io_bound(P.run_pixelize, asset, store.assets, store.config)
    on_log(f"스프라이트 {len(written)}장 생성")

    asset = _resolve(asset_id)
    if asset.rigged:
        for name, paths in (await run.io_bound(P.run_rig, asset, store.config)).items():
            on_log(f"리깅 {name}: {len(paths)}프레임")


async def generate(asset_id: str, on_log: Logger, edit_request: str | None = None) -> None:
    """Draw the asset, then run the deterministic tail.

    Every result is snapshotted, so the previous take is normally already a
    candidate by the time the next one starts. The exception is art that was
    never generated through this app — a hand-supplied file, or one of the seed
    assets — which is rescued here before an edit writes over it. An edit is the
    dangerous case: it uses `raw.png` as both its reference and its destination.
    """
    asset = _resolve(asset_id)
    if history.adopted(asset) is None:
        snap = history.snapshot(asset, source="existing",
                                prompt_hash=P.load_manifest(asset).get("prompt_hash", ""))
        if snap:
            on_log(f"기존 이미지를 이전 버전 {snap.label} 로 보관했습니다")

    on_log("codex 호출 중… (최대 15분)")
    await P.run_generate(asset, store.assets, store.config, on_log, edit_request)
    on_log("이미지 생성 완료")

    snap = history.snapshot(_resolve(asset_id),
                            source="edit" if edit_request else "generate",
                            note=(edit_request or "").strip()[:80])
    if snap:
        on_log(f"새 결과를 버전 {snap.label} 로 저장했습니다")

    await finish(asset_id, on_log)


async def adopt(asset_id: str, n: int, on_log: Logger) -> None:
    """Make an earlier take current again, then rebuild everything downstream."""
    asset = _resolve(asset_id)
    history.adopt(asset, n)
    on_log(f"#{n:03d} 버전으로 되돌렸습니다")
    await finish(asset_id, on_log)


# --------------------------------------------------------------------------
# animation previews
# --------------------------------------------------------------------------

def animations(asset: Asset) -> list[tuple[str, str, list[Path], int]]:
    """(key, label, frame paths, fps) for everything this asset can play."""
    out = []
    if asset.animated:
        out.append((asset.id, "시트", [p for _, p in P.sheet_frames(asset)], asset.fps))
    for clip in asset.clips:
        out.append((f"{asset.id}_{clip['name']}", f"클립 {clip['name']}",
                    [p for _, p in P.clip_frames(asset, clip)], clip["fps"]))
    return out


def build_previews(asset: Asset) -> list[tuple[str, Path]]:
    """Write a looping GIF per animation into the asset's work directory.

    Built from the pixel frames rather than from a packed atlas, so a clip can be
    watched the moment it is rendered instead of after a whole-project build.
    """
    scale = max(2, preview_scale(store.config) // 2)
    out = []
    for key, label, frames, fps in animations(asset):
        gif = anim.write_gif(frames, asset.work / "preview" / f"{key}.gif", fps, scale)
        if gif:
            out.append((label, gif))
    return out

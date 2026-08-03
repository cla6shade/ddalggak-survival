#!/usr/bin/env python3
"""asset-generator, driven from a terminal instead of a browser tab.

    uv run cli.py list                       what exists and how far it got
    uv run cli.py make prop work_desk        one asset from catalog.toml
    uv run cli.py make-category prop         every prop in catalog.toml
    uv run cli.py character founder          the nine-animation character recipe
    uv run cli.py character founder --only idle    just the front view, to look at first
    uv run cli.py tail work_desk             redo the deterministic tail, no model call
    uv run cli.py build                      pack -> tile seam check -> verify

The pipeline is `core/`, untouched: this file is the same sequence `ui/create.py`
runs, with a terminal where the page was. Subjects live in `catalog.toml` so a
run is repeatable and reviewable as a diff rather than as typing in a form.

Only `make`/`make-category`/`character` call the model. Everything after
generation is deterministic, so `tail` and `build` are always free to re-run.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import tomllib
from pathlib import Path

from core import history, recipes as R, rig as rig_mod
from core import pipeline as P
from core.spec import ASSETS, CATEGORIES, ROOT, SPEC_NAME, Asset

CATALOG = ROOT / "catalog.toml"


# --------------------------------------------------------------------------
# logging
# --------------------------------------------------------------------------

def log(message: str) -> None:
    print(message, flush=True)


def stage(message: str) -> None:
    print(f"\n=== {message}", flush=True)


# --------------------------------------------------------------------------
# catalog
# --------------------------------------------------------------------------

def load_catalog() -> dict:
    if not CATALOG.exists():
        raise SystemExit(f"{CATALOG.name} 이 없습니다.")
    with CATALOG.open("rb") as fh:
        return tomllib.load(fh)


def catalog_entry(catalog: dict, category: str, asset_id: str) -> dict:
    entries = catalog.get(category, {})
    entry = entries.get(asset_id)
    if entry is None:
        raise SystemExit(f"catalog.toml 에 [{category}.{asset_id}] 가 없습니다.")
    return entry


def resolve(asset_id: str) -> Asset:
    """Specs are re-read from disk between stages: a stage can rewrite the file
    the next one reads (the rig block is the usual case)."""
    _, assets = P.load()
    for asset in assets:
        if asset.id == asset_id:
            return asset
    raise SystemExit(f"{asset_id}: 스펙을 찾을 수 없습니다")


def overrides_of(entry: dict) -> dict:
    """Everything except the prose is an override for pipeline.toml's defaults."""
    return {k: v for k, v in entry.items() if k not in ("subject", "note")}


# --------------------------------------------------------------------------
# stages
# --------------------------------------------------------------------------

async def run_tail(asset_id: str) -> None:
    """cutout -> pixelize -> rig. Cheap and repeatable, so it always runs whole."""
    config, assets = P.load()
    asset = resolve(asset_id)

    log("  배경 분리…")
    for note in P.run_cutout(asset):
        log(f"  경고: {note}")

    log("  픽셀화…")
    written = P.run_pixelize(asset, assets, config)
    log(f"  스프라이트 {len(written)}장")

    asset = resolve(asset_id)
    if asset.rigged:
        for name, paths in P.run_rig(asset, config).items():
            log(f"  리깅 {name}: {len(paths)}프레임")


async def run_generate(asset_id: str, edit_request: str | None = None) -> None:
    config, assets = P.load()
    asset = resolve(asset_id)

    if history.adopted(asset) is None:
        snap = history.snapshot(asset, source="existing",
                                prompt_hash=P.load_manifest(asset).get("prompt_hash", ""))
        if snap:
            log(f"  기존 이미지를 {snap.label} 로 보관")

    log("  codex 호출 중… (최대 15분)")
    await P.run_generate(asset, assets, config, lambda line: log(f"  · {line}"), edit_request)
    log("  이미지 생성 완료")

    snap = history.snapshot(resolve(asset_id), source="edit" if edit_request else "generate",
                            note=(edit_request or "").strip()[:80])
    if snap:
        log(f"  새 결과를 {snap.label} 로 저장")

    await run_tail(asset_id)


# --------------------------------------------------------------------------
# single assets
# --------------------------------------------------------------------------

def write_single_spec(category: str, asset_id: str, entry: dict) -> None:
    subject = (entry.get("subject") or "").strip()
    if not subject:
        raise SystemExit(f"[{category}.{asset_id}] 에 subject 가 없습니다")
    text = R.render_spec(asset_id=asset_id, category=category, subject=subject,
                         overrides=overrides_of(entry))
    R.write_spec(asset_id, text, category)
    log(f"  스펙: {(ASSETS / category / asset_id / SPEC_NAME).relative_to(ROOT)}")


async def make_one(category: str, asset_id: str, catalog: dict, force: bool = False) -> bool:
    """Returns True when the model was called; False when the asset was skipped."""
    entry = catalog_entry(catalog, category, asset_id)
    directory = ASSETS / category / asset_id

    if (directory / "raw.png").exists() and not force:
        log(f"  건너뜀 — 이미 raw.png 가 있습니다 (--force 로 다시 그립니다)")
        return False

    write_single_spec(category, asset_id, entry)
    await run_generate(asset_id)
    return True


async def make_category(category: str, catalog: dict, force: bool, only: set[str] | None) -> None:
    entries = catalog.get(category, {})
    if not entries:
        raise SystemExit(f"catalog.toml 에 [{category}] 가 비어 있습니다")

    ids = [i for i in entries if only is None or i in only]
    for index, asset_id in enumerate(ids, start=1):
        stage(f"[{index}/{len(ids)}] {category}/{asset_id}")
        try:
            await make_one(category, asset_id, catalog, force)
        except Exception as err:                       # noqa: BLE001 — keep the batch going
            log(f"  실패: {err}")


# --------------------------------------------------------------------------
# character — the nine-animation recipe
# --------------------------------------------------------------------------

async def run_character(group: str, catalog: dict, only: set[str] | None, force: bool) -> None:
    """The same order ui/create.py runs: base sheet, other views, then rig clips.

    The base view is the character. Every other view is drawn with it as both the
    reference and the palette donor, so look at the base before running the rest.
    """
    entry = catalog_entry(catalog, "character", group)
    subject = (entry.get("subject") or "").strip()
    overrides = overrides_of(entry)

    preset = R.load_preset()
    base = R.base_of(preset)
    steps = R.plan(group, preset, selected=only)
    rig_written: set[str] = set()

    for index, step in enumerate(steps, start=1):
        animation = step.animation
        stage(f"[{index}/{len(steps)}] {animation.label} ({animation.kind}) -> {step.asset_id}")

        if animation.kind == "rig":
            await rig_step(group, subject, preset, base, animation, overrides, rig_written, only)
            continue

        raw = ASSETS / "character" / step.asset_id / "raw.png"
        if raw.exists() and not force:
            log("  건너뜀 — 이미 raw.png 가 있습니다 (--force 로 다시 그립니다)")
            continue

        if animation.is_base:
            text = R.base_spec(group, subject, animation, overrides)
        else:
            text = R.view_spec(group, subject, animation, base, overrides)
        R.write_spec(step.asset_id, text)
        log(f"  스펙: assets/character/{step.asset_id}/{SPEC_NAME}")

        await run_generate(step.asset_id)


def measure_parts(sprite_path: Path) -> dict:
    """Rig rectangles for a sprite, with a silhouette fallback.

    `rig.suggest_parts` finds the leg line by brightness: it scans up from the
    bottom for the last row with no light pixel, assuming dark trousers below a
    lighter torso and nothing light near the floor. Light-coloured shoes break
    that — a slipper three rows off the bottom leaves no band to call legs, so it
    gives up and the clip would have nothing to move.

    The silhouette says the same thing without depending on colour: legs are
    narrower than the torso, so the leg line is where the sprite stops being
    narrow on the way up.
    """
    from PIL import Image

    image = Image.open(sprite_path).convert("RGBA")
    guess = rig_mod.suggest_parts(image)
    if guess:
        return guess

    px = image.load()
    width, height = image.size
    widths = [sum(1 for x in range(width) if px[x, y][3]) for y in range(height)]
    filled = [y for y, n in enumerate(widths) if n]
    if not filled:
        return {}

    bottom = filled[-1]
    narrow = widths[bottom]
    top = bottom
    while top > 0 and widths[top - 1] <= narrow * 1.15:
        top -= 1
    if bottom - top < 3:
        return {}

    parts = {"upper": (0, 0, width, top)}
    parts.update(split_legs(px, width, height, top))
    return parts


def split_legs(px, width: int, height: int, top: int) -> dict:
    """Cut the leg band in two at the gap between the legs.

    The gap is a dip near the middle; the edges taper too, so only interior
    columns are considered and sparse ones (a shoe tip) are dropped first.
    """
    band = height - top
    columns = {x: sum(1 for y in range(top, height) if px[x, y][3]) for x in range(width)}
    solid = [x for x, n in columns.items() if n >= band * 0.6]
    if len(solid) < 6:
        return {}

    left, right = min(solid), max(solid) + 1
    span = right - left
    margin = max(2, span // 4)
    interior = range(left + margin, right - margin)
    if not interior:
        return {}

    split = min(interior, key=lambda x: (columns[x], abs(x - (left + right) / 2)))
    return {"leg_l": (left, top, split, height), "leg_r": (split, top, right, height)}


async def rig_step(group: str, subject: str, preset, base, animation,
                   overrides: dict, rig_written: set[str], only: set[str] | None) -> None:
    """Cut rectangles out of the target's finished sprite and compose the clip.

    No model call: the frames are the same pixels moved by whole numbers.
    """
    target = next(a for a in preset if a.name == animation.target)
    target_id = target.asset_id(group)
    asset = resolve(target_id)

    sprite = P.sprite_path(asset, 0)
    if not sprite.exists():
        raise SystemExit(f"{target_id}: 픽셀 스프라이트가 없습니다. {target.label}을 먼저 완료하세요.")

    if target_id not in rig_written:
        selected = {a.name for a in preset} if only is None else only
        guess = measure_parts(sprite)
        wanted = R.required_parts(preset, target.name, selected)
        missing = [p for p in wanted if p not in guess]
        if missing:
            raise SystemExit(
                f"{target_id}: 스프라이트에서 파트를 찾지 못했습니다 ({', '.join(missing)}). "
                f"assets/character/{target_id}/asset.toml 의 [rig] parts 를 직접 적고 "
                f"`uv run cli.py tail {target_id}` 를 다시 돌리세요."
            )
        parts = {k: v for k, v in guess.items() if k in wanted}
        clips = R.rig_clips(preset, selected).get(target.name, [])

        if target.is_base:
            text = R.base_spec(group, subject, target, overrides=overrides,
                               reference_file=asset.reference_file,
                               reference_from=asset.reference_from,
                               parts=parts, clips=clips)
        else:
            text = R.view_spec(group, subject, target, base, overrides=overrides,
                               parts=parts, clips=clips)
        R.write_spec(target_id, text)
        rig_written.add(target_id)
        log("  리그 파트: " + ", ".join(f"{n}={list(b)}" for n, b in sorted(parts.items())))

    config, _ = P.load()
    for name, paths in P.run_rig(resolve(target_id), config, animation.clip).items():
        log(f"  클립 {name}: {len(paths)}프레임")


# --------------------------------------------------------------------------
# build and list
# --------------------------------------------------------------------------

def run_build() -> int:
    config, assets = P.load()

    stage("패킹")
    report = P.build_atlas(assets, config)
    log(f"  프레임 {report['frames']}장 · {report['size'][0]}x{report['size'][1]} · "
        f"채움 {report['fill']:.1f}%")
    for anim in report["anims"]:
        log(f"  애니메이션 {anim['key']}: {anim['frames']}프레임 @{anim['fps']}fps")

    stage("타일 심 검사")
    tiles = P.check_tiles(assets)
    if not tiles:
        log("  타일 없음")
    for tile in tiles:
        mark = "OK" if tile.ok else "이음매"
        log(f"  {tile.id} ({tile.size}px): 가로 {tile.horizontal:.2f} 세로 {tile.vertical:.2f} — {mark}")

    backgrounds = P.export_backgrounds(assets)
    if backgrounds:
        stage("배경 내보내기")
        log(f"  {len(backgrounds)}장 → dist/backgrounds/")

    stage("검증")
    problems = P.verify_atlas()
    for problem in problems:
        log(f"  {problem}")
    if not problems:
        log("  이상 없음")

    failed = [t.id for t in tiles if not t.ok]
    if failed:
        log(f"\n타일 이음매: {', '.join(failed)}")
    return 1 if (problems or failed) else 0


def run_list() -> None:
    _, assets = P.load()
    if not assets:
        log("에셋이 없습니다.")
        return
    for asset in assets:
        state = P.state(asset)
        marks = []
        marks.append("raw" if state.has_raw else "raw 없음")
        marks.append("pixel" if state.has_pixel else "pixel 없음")
        if state.rigged_clips:
            marks.append(f"clips={len(state.rigged_clips)}")
        if state.stale:
            marks.append("프롬프트 변경됨")
        log(f"{asset.category:10} {asset.id:34} {' · '.join(marks)}")


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------

def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="cli.py", description="asset-generator를 터미널에서 몹니다")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="라이브러리 상태")
    sub.add_parser("build", help="패킹 → 타일 심 검사 → 검증")

    one = sub.add_parser("make", help="catalog.toml 의 에셋 하나")
    one.add_argument("category", choices=[c for c in CATEGORIES if c != "character"])
    one.add_argument("id")
    one.add_argument("--force", action="store_true", help="raw.png 이 있어도 다시 그립니다")

    many = sub.add_parser("make-category", help="catalog.toml 의 카테고리 전체")
    many.add_argument("category", choices=[c for c in CATEGORIES if c != "character"])
    many.add_argument("--only", default="", help="쉼표로 구분한 id 목록")
    many.add_argument("--force", action="store_true")

    character = sub.add_parser("character", help="캐릭터 9종 레시피")
    character.add_argument("group")
    character.add_argument("--only", default="", help="쉼표로 구분한 애니메이션 이름 (idle 등)")
    character.add_argument("--force", action="store_true")

    tail = sub.add_parser("tail", help="모델 호출 없이 배경 분리→픽셀화→리깅만")
    tail.add_argument("id")

    edit = sub.add_parser("edit", help="지금 이미지를 보여 주고 이것만 바꾸라고 지시")
    edit.add_argument("id")
    edit.add_argument("request")

    return parser.parse_args(argv)


def split(value: str) -> set[str] | None:
    names = {part.strip() for part in value.split(",") if part.strip()}
    return names or None


async def main(argv: list[str]) -> int:
    args = parse_args(argv)

    if args.command == "list":
        run_list()
        return 0
    if args.command == "build":
        return run_build()
    if args.command == "tail":
        stage(f"{args.id} — 결정적 단계만")
        await run_tail(args.id)
        return 0
    if args.command == "edit":
        stage(f"{args.id} — 수정")
        await run_generate(args.id, args.request)
        return 0

    catalog = load_catalog()
    if args.command == "make":
        stage(f"{args.category}/{args.id}")
        await make_one(args.category, args.id, catalog, args.force)
        return 0
    if args.command == "make-category":
        await make_category(args.category, catalog, args.force, split(args.only))
        return 0
    if args.command == "character":
        await run_character(args.group, catalog, split(args.only), args.force)
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1:])))

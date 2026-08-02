"""The build page: pack every sprite into one atlas, then prove it is sound.

Three stages that only make sense together. Packing writes the atlas, the tile
check catches a floor texture that does not actually wrap, and verify reads the
result back and compares it against its own JSON. A build that skips the last two
is a build that ships a broken atlas quietly.
"""

from __future__ import annotations

from nicegui import run, ui

from core import pipeline as P

from .state import DIST, file_url, store
from .widgets import PIXELATED, notify_error, raw_image


def render() -> None:
    store.reload()
    with ui.column().classes("w-full max-w-5xl mx-auto p-6 gap-4"):
        with ui.row().classes("w-full items-center justify-between"):
            ui.label("빌드").classes("text-2xl font-medium")
            ui.button("아틀라스 빌드", icon="build", on_click=_build).props("unelevated")

        ui.label("픽셀 스프라이트가 모두 준비된 에셋만 아틀라스에 들어갑니다. "
                 "타일은 GPU 반복 래핑이 필요해서 아틀라스 대신 개별 텍스처로 나갑니다.") \
          .classes("text-sm text-gray-500")

        results()


@ui.refreshable
def results() -> None:
    atlas = DIST / "atlas.png"
    if not atlas.exists():
        with ui.card().classes("w-full items-center p-10 gap-2"):
            ui.icon("grid_view", size="48px").classes("text-gray-300")
            ui.label("아직 빌드된 아틀라스가 없습니다").classes("text-gray-500")
        return

    import json
    doc = json.loads((DIST / "atlas.json").read_text())
    size = doc["meta"]["size"]

    with ui.card().classes("w-full"):
        ui.label("dist/atlas.png").classes("font-medium")
        ui.label(f"{len(doc['frames'])}개 프레임 · {size['w']}x{size['h']}") \
          .classes("text-sm text-gray-500")
        raw_image(file_url(atlas),
                  PIXELATED + "width:100%;max-width:42rem;background:#222;"
                              "border-radius:6px;")

    anims_file = DIST / "animations.json"
    if anims_file.exists():
        anims = json.loads(anims_file.read_text())["anims"]
        with ui.card().classes("w-full"):
            ui.label(f"애니메이션 {len(anims)}개").classes("font-medium")
            with ui.row().classes("gap-2 flex-wrap"):
                for a in anims:
                    ui.chip(f"{a['key']} · {len(a['frames'])}f @ {a['frameRate']}fps") \
                      .props("dense outline")

    tiles = sorted((DIST / "tiles").glob("*.png")) if (DIST / "tiles").is_dir() else []
    if tiles:
        with ui.card().classes("w-full"):
            ui.label(f"타일 텍스처 {len(tiles)}개").classes("font-medium")
            with ui.row().classes("gap-4 flex-wrap"):
                for path in tiles:
                    with ui.column().classes("items-center gap-1"):
                        raw_image(file_url(path),
                                  PIXELATED + "width:96px;height:96px;border-radius:4px;")
                        ui.label(path.stem).classes("text-xs text-gray-500")


async def _build() -> None:
    try:
        store.reload()
        stats = await run.io_bound(P.build_atlas, store.assets, store.config)
        reports = await run.io_bound(P.check_tiles, store.assets)
        problems = await run.io_bound(P.verify_atlas)

        seams = [r for r in reports if not r.ok]
        if problems:
            ui.notify("검증 실패: " + "; ".join(problems), type="negative",
                      multi_line=True, close_button="닫기", timeout=0)
        elif seams:
            detail = ", ".join(
                f"{r.id} (h={r.horizontal:.2f} v={r.vertical:.2f})" for r in seams)
            ui.notify(f"이음매가 보이는 타일: {detail}", type="warning",
                      multi_line=True, close_button="닫기", timeout=0)
        else:
            ui.notify(
                f"빌드 완료 — {stats['frames']}개 프레임, "
                f"{stats['size'][0]}x{stats['size'][1]}, {stats['fill']:.0f}% 충전, "
                f"애니메이션 {len(stats['anims'])}개", type="positive")
        results.refresh()
    except Exception as err:                           # noqa: BLE001 - shown to the user
        notify_error(err)

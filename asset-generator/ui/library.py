"""The library: everything that exists, and everything you can do to it.

Characters are shown grouped, because five asset directories are one character
and listing them flat hides that. Every other category is a flat grid, since
there is nothing to group.
"""

from __future__ import annotations

import shutil

from nicegui import ui

from core import history
from core import pipeline as P
from core.spec import CATEGORIES, ROOT, Asset

from . import tasks
from .state import (CATEGORY_ICONS, CATEGORY_LABELS, file_url, stage_images,
                    store, thumbnail)
from .widgets import (SURFACE, LogConsole, confirm, notify_error, pixel_image,
                      shape_label, stage_strip, state_chips)


def render() -> None:
    store.reload()
    with ui.column().classes("w-full max-w-6xl mx-auto p-6 gap-4"):
        with ui.row().classes("w-full items-center justify-between"):
            ui.label("라이브러리").classes("text-2xl font-medium")
            with ui.row().classes("gap-2 items-center"):
                ui.label(f"에셋 {len(store.assets)}개").classes("text-sm text-gray-500")
                ui.button("다시 읽기", icon="refresh",
                          on_click=lambda: (store.reload(), body.refresh())) \
                  .props("flat dense")

        if store.error:
            with ui.card().classes("w-full bg-red-50 border border-red-200"):
                ui.label("스펙을 읽지 못했습니다").classes("font-medium text-red-700")
                ui.label(store.error).classes("text-sm text-red-600 whitespace-pre-wrap")

        body()


@ui.refreshable
def body() -> None:
    populated = [c for c in CATEGORIES if store.in_category(c)]
    if not populated:
        with ui.card().classes("w-full items-center p-10 gap-2"):
            ui.icon("inbox", size="48px").classes("text-gray-300")
            ui.label("아직 에셋이 없습니다").classes("text-gray-500")
            ui.button("에셋 만들기", icon="add",
                      on_click=lambda: ui.navigate.to("/create")).props("unelevated")
        return

    with ui.tabs().classes("w-full") as tabs:
        for category in populated:
            ui.tab(category, label=f"{CATEGORY_LABELS[category]} "
                                   f"({len(store.in_category(category))})",
                   icon=CATEGORY_ICONS[category])
    with ui.tab_panels(tabs, value=populated[0], animated=False).classes("w-full"):
        for category in populated:
            with ui.tab_panel(category).classes("p-0 pt-4"):
                if category == "character":
                    _character_groups()
                else:
                    _flat_grid(store.in_category(category))


def _character_groups() -> None:
    grouped, loose = store.groups("character")
    for name, members in sorted(grouped.items()):
        with ui.card().classes("w-full mb-4"):
            with ui.row().classes("w-full items-center gap-2"):
                ui.icon("person", size="20px").classes("text-gray-500")
                ui.label(name).classes("text-lg font-medium")
                ui.label(f"{len(members)}개 뷰").classes("text-sm text-gray-500")
            ui.separator()
            _flat_grid(sorted(members, key=lambda a: a.id))
    if loose:
        _flat_grid(sorted(loose, key=lambda a: a.id))


def _flat_grid(assets: list[Asset]) -> None:
    with ui.row().classes("gap-4 flex-wrap"):
        for asset in assets:
            _card(asset)


def _card(asset: Asset) -> None:
    with ui.card().classes("w-56 cursor-pointer hover:shadow-lg transition-shadow") \
            .on("click", lambda a=asset: detail(a.id)):
        with ui.row().classes("w-full justify-center"):
            pixel_image(thumbnail(asset), 120)
        ui.label(asset.id).classes("font-medium truncate w-full")
        ui.label(shape_label(asset)).classes("text-xs text-gray-500")
        with ui.row().classes("gap-1 flex-wrap"):
            state_chips(asset)


# --------------------------------------------------------------------------
# detail
# --------------------------------------------------------------------------

def detail(asset_id: str) -> None:
    store.reload()
    asset = store.by_id(asset_id)
    if asset is None:
        ui.notify(f"{asset_id}: 스펙을 찾을 수 없습니다", type="negative")
        return

    # A maximized dialog draws no surface of its own, so the card has to supply
    # one — otherwise the library grid shows through the sprites being judged.
    # Header and actions are pinned and only the middle scrolls: the actions are
    # what the dialog is for, and a long frame list must not push them off-screen.
    #
    # `flex-nowrap`, not Quasar's `flex`: that class carries `flex-wrap: wrap`,
    # and a wrapping column of fixed height spills its overflow into a *second
    # column* — the tall spec tab pushed the panel and the action bar a full
    # viewport to the right each.
    with ui.dialog().props("maximized") as dialog, \
            ui.card().classes(f"w-full h-full p-0 gap-0 flex-nowrap {SURFACE}"):
        with ui.column().classes("w-full p-4 pb-2 gap-2 shrink-0"):
            with ui.row().classes("w-full items-center justify-between"):
                with ui.row().classes("items-center gap-3"):
                    ui.label(asset.id).classes("text-xl font-medium")
                    ui.label(f"{CATEGORY_LABELS[asset.category]} · {shape_label(asset)}") \
                      .classes("text-sm text-gray-500")
                ui.button(icon="close", on_click=dialog.close).props("flat round dense")
            with ui.row().classes("gap-1 flex-wrap"):
                state_chips(asset)

        console = LogConsole("140px")
        # The inset has to come out of the width rather than sit outside it. The
        # card is the `.q-dialog__inner > div` Quasar gives `overflow: auto`, and
        # `w-full` + `mx-4` is 100% + 2rem — the card is not stretching its
        # children (`.nicegui-card` aligns them to flex-start), so those two
        # margins hung off the edge and put a horizontal scrollbar across the
        # whole dialog the moment 재생성 unhid the console.
        console.log.classes("hidden").style("width: calc(100% - 2rem); margin: 0 1rem;")

        with ui.tabs().classes("w-full shrink-0") as tabs:
            ui.tab("stages", label="단계별 이미지", icon="layers")
            ui.tab("anim", label="애니메이션", icon="play_circle")
            ui.tab("candidates", label="이전 버전", icon="history")
            ui.tab("spec", label="스펙", icon="description")
        # `min-h-0` so the panel is allowed to be shorter than its content: a flex
        # child defaults to min-height:auto and would otherwise grow to fit the
        # spec dump instead of scrolling it.
        # `animated=False`: the slide transition NiceGUI turns on by default pushes
        # the outgoing panel sideways out of the container, and every tab switch
        # flashes a horizontal scrollbar for the length of the animation.
        # `overflow-hidden`, not `auto`: Quasar's own `.q-panel` inside already
        # scrolls, and a second scroll container here just means a second bar.
        with ui.tab_panels(tabs, value="stages", animated=False) \
                .classes("w-full grow min-h-0 overflow-hidden"):
            with ui.tab_panel("stages"):
                stage_strip(stage_images(asset), 160)
                _all_frames(asset)
            with ui.tab_panel("anim"):
                _animations(asset)
            with ui.tab_panel("candidates"):
                _candidates(asset.id, dialog, console)
            with ui.tab_panel("spec"):
                _spec(asset)

        with ui.row().classes("w-full p-4 border-t shrink-0"):
            _actions(asset, dialog, console)

    dialog.open()


def _all_frames(asset: Asset) -> None:
    """Every pixel frame the asset owns, sheet frames and clip frames alike."""
    groups: list[tuple[str, list]] = []
    if asset.animated:
        groups.append(("시트 프레임", P.sheet_frames(asset)))
    for clip in asset.clips:
        groups.append((f"클립 {clip['name']}", P.clip_frames(asset, clip)))
    if not groups:
        return
    ui.separator().classes("my-3")
    for label, frames in groups:
        ui.label(label).classes("text-sm text-gray-600 mt-2")
        with ui.row().classes("gap-2 flex-wrap"):
            for name, path in frames:
                with ui.column().classes("items-center gap-0"):
                    pixel_image(file_url(path), 72)
                    ui.label(name.rsplit("_", 1)[-1]).classes("text-xs text-gray-400")


def _animations(asset: Asset) -> None:
    previews = tasks.build_previews(asset)
    if not previews:
        ui.label("재생할 애니메이션이 없습니다. "
                 "시트 에셋이거나 리그 클립이 있어야 합니다.") \
          .classes("text-sm text-gray-500")
        return
    with ui.row().classes("gap-8 flex-wrap items-end"):
        for label, gif in previews:
            with ui.column().classes("items-center gap-2"):
                # A GIF loops on its own, which is the whole point: the sprite has
                # to be judged in motion, not frame by frame.
                pixel_image(file_url(gif), 180)
                ui.label(label).classes("text-sm text-gray-600")


def _candidates(asset_id: str, dialog, console: LogConsole) -> None:
    asset = store.by_id(asset_id)
    items = history.list_candidates(asset)
    current = history.adopted(asset)
    if not items:
        ui.label("아직 보관된 이전 버전이 없습니다. "
                 "재생성하거나 수정할 때마다 직전 이미지가 여기에 쌓입니다.") \
          .classes("text-sm text-gray-500")
        return

    ui.label("되돌리면 raw 이미지가 그 버전으로 교체되고 배경 분리부터 다시 실행됩니다. "
             "모델을 다시 부르지 않으니 즉시 끝납니다.") \
      .classes("text-sm text-gray-500 mb-2")
    with ui.row().classes("gap-4 flex-wrap"):
        for candidate in items:
            is_current = current is not None and current.n == candidate.n
            classes = "w-48" + (" ring-2 ring-primary" if is_current else "")
            with ui.card().classes(classes):
                pixel_image(file_url(candidate.raw), 160)
                ui.label(candidate.label).classes("text-sm font-medium truncate w-full")
                ui.label(candidate.source).classes("text-xs text-gray-400")
                if candidate.created_at:
                    ui.label(candidate.created_at[:19]).classes("text-xs text-gray-400")
                if is_current:
                    ui.chip("현재", color="primary").props("dense text-color=white")
                else:
                    ui.button("이 버전으로", on_click=lambda c=candidate: _adopt(
                        asset_id, c.n, dialog, console)).props("flat dense")


def _spec(asset: Asset) -> None:
    ui.label(str(asset.spec_file.relative_to(ROOT))).classes("text-xs text-gray-400")
    ui.code(asset.spec_file.read_text(), language="toml").classes("w-full")


# --------------------------------------------------------------------------
# actions
# --------------------------------------------------------------------------

def _actions(asset: Asset, dialog, console: LogConsole) -> None:
    with ui.row().classes("w-full gap-2 flex-wrap items-center"):
        if not asset.imported:
            ui.button("재생성", icon="autorenew",
                      on_click=lambda: _run(asset.id, dialog, console,
                                            regenerate=True)).props("unelevated")
            ui.button("수정", icon="edit",
                      on_click=lambda: _edit_dialog(asset.id, dialog, console)) \
              .props("outline")
        ui.button("픽셀화 다시", icon="grid_on",
                  on_click=lambda: _run(asset.id, dialog, console)).props("outline")
        ui.space()
        ui.button("삭제", icon="delete",
                  on_click=lambda: _delete(asset.id, dialog)).props("flat color=negative")


def _edit_dialog(asset_id: str, parent, console: LogConsole) -> None:
    with ui.dialog() as dialog, ui.card().classes("w-[32rem]"):
        ui.label("codex로 수정").classes("text-lg font-medium")
        ui.label("현재 이미지를 레퍼런스로 보여주고, 아래에 적은 것만 바꿔서 다시 그립니다. "
                 "지금 이미지는 '이전 버전' 탭에 남으니 언제든 되돌릴 수 있습니다.") \
          .classes("text-sm text-gray-600")
        request = ui.textarea(placeholder="예: 넥타이를 빨간색으로 바꿔줘") \
                    .props("outlined autogrow").classes("w-full")
        with ui.row().classes("w-full justify-end gap-2"):
            ui.button("취소", on_click=dialog.close).props("flat")
            def go() -> None:
                text = (request.value or "").strip()
                if not text:
                    ui.notify("수정 내용을 입력하세요", type="warning")
                    return
                dialog.close()
                _run(asset_id, parent, console, regenerate=True, edit_request=text)
            ui.button("수정 실행", on_click=go).props("unelevated")
    dialog.open()


async def _run(asset_id: str, dialog, console: LogConsole, *, regenerate: bool = False,
               edit_request: str | None = None) -> None:
    """Awaited from the click handler, not deferred to a `ui.timer` — the refresh
    at the end deletes this dialog's slot, and a timer living there would die
    with it before running."""
    console.log.classes(remove="hidden")
    console.clear()
    try:
        if regenerate:
            await tasks.generate(asset_id, console.push, edit_request)
        else:
            await tasks.finish(asset_id, console.push)
        console.push("완료")
        ui.notify(f"{asset_id} 처리 완료", type="positive")
        dialog.close()
        body.refresh()
    except Exception as err:                           # noqa: BLE001 - shown to the user
        console.push(f"실패: {err}")
        notify_error(err)


async def _adopt(asset_id: str, n: int, dialog, console: LogConsole) -> None:
    console.log.classes(remove="hidden")
    console.clear()
    try:
        await tasks.adopt(asset_id, n, console.push)
        ui.notify(f"#{n:03d} 버전으로 되돌렸습니다", type="positive")
        dialog.close()
        body.refresh()
    except Exception as err:                           # noqa: BLE001
        console.push(f"실패: {err}")
        notify_error(err)


def _delete(asset_id: str, dialog) -> None:
    asset = store.by_id(asset_id)
    blockers = P.referrers(asset, store.assets)
    warning = ""
    if blockers:
        names = ", ".join(a.id for a in blockers)
        warning = (f"\n\n주의: {names} 이(가) 이 에셋을 레퍼런스나 팔레트 원본으로 "
                   f"쓰고 있습니다. 삭제하면 그 에셋들을 다시 만들 수 없습니다.")

    def go() -> None:
        shutil.rmtree(asset.dir)
        store.reload()
        ui.notify(f"{asset_id} 삭제됨 — 아틀라스를 다시 빌드하세요", type="warning")
        dialog.close()
        body.refresh()

    confirm("에셋 삭제",
            f"{asset_id} 디렉터리를 통째로 지웁니다. 이전 버전 기록도 함께 사라집니다."
            + warning, go, danger=True)

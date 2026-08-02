"""Small shared pieces: pixel-correct images, status chips, a log console.

Every sprite in this app is pixel art viewed far above 1:1, so `image-rendering:
pixelated` is not a style choice — smoothing turns a 64px sprite into mush and
hides exactly the aliasing the artist is checking for.
"""

from __future__ import annotations

from typing import Callable

from nicegui import ui

from core import pipeline as P
from core.spec import Asset

PIXELATED = "image-rendering: pixelated; image-rendering: crisp-edges;"

# A maximized dialog paints no surface of its own, so the card inside it has to.
# Quasar's class on <body> is the only reliable signal for which surface to
# paint: Tailwind's `dark:` variant keys off its own build configuration, not off
# Quasar's theme, so `bg-white dark:bg-slate-900` can leave a white card under
# white dark-mode text.
SURFACE = "ag-surface"
LOG = "ag-log"
# The detail dialog's tab panels are each a different height, so a visible
# scrollbar appears on one tab and not the next — and every appearance steals
# ~15px of width, so the sprites shift sideways as you tab through them. The
# panels still scroll by wheel; only the bar is gone.
#
# Log lines are `white-space: pre` by default and codex writes long ones, which
# gave every console its own horizontal scrollbar. These are progress messages,
# not aligned columns, so wrapping them loses nothing; `anywhere` is for the
# absolute paths, which have no space to break at.
ui.add_css(f"""
.{SURFACE} {{ background: #ffffff; }}
body.body--dark .{SURFACE} {{ background: #1d1d1d; }}
.{SURFACE} .q-panel.scroll {{ scrollbar-width: none; }}
.{SURFACE} .q-panel.scroll::-webkit-scrollbar {{ width: 0; height: 0; }}
.{LOG} .q-scrollarea__content {{
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}}
""", shared=True)
CHECKER = (
    "background-image:"
    "linear-gradient(45deg,rgba(128,128,128,.22) 25%,transparent 25%),"
    "linear-gradient(-45deg,rgba(128,128,128,.22) 25%,transparent 25%),"
    "linear-gradient(45deg,transparent 75%,rgba(128,128,128,.22) 75%),"
    "linear-gradient(-45deg,transparent 75%,rgba(128,128,128,.22) 75%);"
    "background-size:16px 16px;"
    "background-position:0 0,0 8px,8px -8px,-8px 0;"
)


def raw_image(url: str, style: str = ""):
    """A plain <img>, not Quasar's q-img.

    q-img wraps every image in a ratio box with a loading spinner, which for a
    64x64 sprite never resolves visually and leaves a spinner sitting on top of a
    picture that loaded instantly. Nothing here needs lazy loading or ratios.
    """
    return ui.element("img").props(f'src="{url}"').style(style)


def pixel_image(url: str, size: int = 96, checker: bool = True):
    """One sprite on a checkerboard, so transparent and white are told apart."""
    style = f"width:{size}px;height:{size}px;" + (CHECKER if checker else "")
    with ui.element("div").style(style + "border-radius:6px;overflow:hidden;") as box:
        if url:
            raw_image(url, f"width:100%;height:100%;object-fit:contain;{PIXELATED}")
        else:
            ui.icon("hide_image", size="32px").classes(
                "text-gray-400 w-full h-full flex items-center justify-center")
    return box


def stage_strip(stages: list[tuple[str, str]], size: int = 128) -> None:
    """raw -> cut -> pixel, side by side. Which stage broke is then obvious."""
    if not stages:
        ui.label("아직 만들어진 이미지가 없습니다").classes("text-sm text-gray-500")
        return
    with ui.row().classes("gap-6 items-end flex-wrap"):
        for label, url in stages:
            with ui.column().classes("items-center gap-1"):
                pixel_image(url, size)
                ui.label(label).classes("text-xs text-gray-500")


def state_chips(asset: Asset) -> None:
    """What exists on disk for this asset, and whether it is out of date."""
    st = P.state(asset)
    chips = []
    if asset.imported:
        chips.append(("반입됨", "blue-grey"))
    if not st.has_raw:
        chips.append(("이미지 없음", "red"))
    elif not st.has_pixel:
        chips.append(("픽셀화 안 됨", "orange"))
    if st.stale:
        chips.append(("프롬프트 변경됨", "amber"))
    for name in st.rigged_clips:
        chips.append((f"리깅 {name}", "teal"))
    if not chips:
        chips.append(("완료", "green"))
    for text, colour in chips:
        ui.chip(text, color=colour).props("dense text-color=white").classes("text-xs")


def shape_label(asset: Asset) -> str:
    frames = f"{asset.rows}x{asset.cols} · {asset.frames}프레임" if asset.animated else "단일 프레임"
    return f"{asset.size}px · {frames}"


class LogConsole:
    """A scrolling log that can be written to from a background task."""

    def __init__(self, height: str = "220px") -> None:
        self.log = ui.log().classes(f"w-full font-mono text-xs {LOG}").style(
            f"height:{height};background:#111;color:#ddd;border-radius:6px;")

    def push(self, message: str) -> None:
        self.log.push(message)

    def clear(self) -> None:
        self.log.clear()


def confirm(title: str, message: str, on_yes: Callable[[], None],
            danger: bool = False) -> None:
    """A modal that has to be answered before anything irreversible happens."""
    with ui.dialog() as dialog, ui.card().classes("w-96"):
        ui.label(title).classes("text-lg font-medium")
        ui.label(message).classes("text-sm text-gray-600 whitespace-pre-wrap")
        with ui.row().classes("w-full justify-end gap-2 mt-2"):
            ui.button("취소", on_click=dialog.close).props("flat")
            def go() -> None:
                dialog.close()
                on_yes()
            ui.button("확인", on_click=go).props(
                "color=negative" if danger else "color=primary")
    dialog.open()


def notify_error(err: Exception) -> None:
    ui.notify(str(err), type="negative", multi_line=True,
              close_button="닫기", timeout=0)

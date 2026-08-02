#!/usr/bin/env python3
"""asset-generator — prompt to packed atlas, with something to look at in between.

    uv run app.py              a browser tab on :8111, reloading as you edit

Three pages: make an asset, browse what exists, build the atlas. The pipeline
underneath is the same deterministic one the old CLI ran; what this adds is a
place to stop between stages and see what came out.
"""

from __future__ import annotations

from nicegui import app, ui

from core.spec import ASSETS
from ui import build, create, library
from ui.state import ASSET_MOUNT, DIST, DIST_MOUNT

PAGES = [
    ("/", "라이브러리", "photo_library"),
    ("/create", "새로 만들기", "add_photo_alternate"),
    ("/build", "빌드", "build"),
]

# Sprites are read straight off disk rather than copied into a static dir, so
# what the page shows is always the file the pipeline just wrote.
ASSETS.mkdir(parents=True, exist_ok=True)
DIST.mkdir(parents=True, exist_ok=True)
app.add_static_files(ASSET_MOUNT, ASSETS)
app.add_static_files(DIST_MOUNT, DIST)


def shell(active: str) -> None:
    with ui.header().classes("items-center justify-between px-4 py-2 bg-slate-800"):
        with ui.row().classes("items-center gap-2"):
            ui.icon("auto_awesome_mosaic", size="24px")
            ui.label("asset-generator").classes("text-lg font-medium")
        with ui.row().classes("gap-1"):
            for path, label, icon in PAGES:
                button = ui.button(label, icon=icon,
                                   on_click=lambda p=path: ui.navigate.to(p))
                button.props("flat color=white" if path != active else "unelevated")


@ui.page("/")
def page_library() -> None:
    shell("/")
    library.render()


@ui.page("/create")
def page_create() -> None:
    shell("/create")
    create.render()


@ui.page("/build")
def page_build() -> None:
    shell("/build")
    build.render()


# Reload watches `*.py` under the cwd only, so the sprites and specs the pipeline
# writes all day never trigger it — but a running generation dies with the
# restart, so save a .py while codex is drawing and you lose that run.
#
# The port is fixed because a stable http://localhost:8111 is worth something.
ui.run(title="asset-generator", favicon="🎨", dark=None, show=False, port=8111)

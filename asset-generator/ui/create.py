"""Making a new asset.

Two shapes of work share this page. A prop, icon, effect or tile is one asset:
describe it, draw it, done. A character is five, and they are not independent —
the front view is the character, and the other four are that drawing re-posed. So
a character runs as an ordered plan that stops after every step, because the only
way to know a view came out right is to look at it before spending the next call.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from pathlib import Path

from nicegui import events, run, ui

from core import history
from core import pipeline as P
from core import recipes as R
from core import rig as rig_mod
from core.spec import ASSETS, CATEGORIES, ROOT, SPEC_NAME

from . import tasks
from .state import (CATEGORY_HINTS, CATEGORY_ICONS, CATEGORY_LABELS, file_url,
                    store, thumbnail)
from .widgets import LogConsole, notify_error, pixel_image

# Overrides worth surfacing, and how to render each. Everything else in
# OVERRIDABLE stays where it belongs — in the spec file, for the rare asset that
# needs it — rather than turning this form into a wall of knobs.
NUMERIC = {
    "size": ("캔버스 크기 (px)", "prop은 이 값이 곧 상대 스케일입니다"),
    "colors": ("색 수", ""),
    "outline_width": ("아웃라인 두께 (px)", "0이면 아웃라인 없음"),
}
CHOICES = {
    "background": (["chroma", "flood", "opaque"], "배경 분리 방식"),
    "fit": (["contain", "bottom", "fill"], "캔버스에 앉히는 방식"),
}


@dataclass
class Reference:
    """Where the reference image comes from, if there is one at all."""
    kind: str = "none"                  # none | upload | path | asset | candidate
    data: bytes | None = None
    text: str = ""                      # a filesystem path, or an asset id
    candidate: int = 0

    @property
    def is_set(self) -> bool:
        return self.kind != "none" and (self.data is not None or self.text)

    def describe(self) -> str:
        return {
            "none": "없음 (새로 그림)",
            "upload": f"업로드: {self.text}",
            "path": f"파일: {self.text}",
            "asset": f"기존 에셋: {self.text}",
            "candidate": f"이전 버전: {self.text} #{self.candidate:03d}",
        }[self.kind]


@dataclass
class StepState:
    step: R.Step
    status: str = "pending"             # pending | running | done | failed
    message: str = ""


@dataclass
class Run:
    """A character build in progress: the plan, and how far down it we are."""
    group: str
    subject: str
    overrides: dict
    reference: Reference
    preset: list
    steps: list[StepState] = field(default_factory=list)
    parts: dict = field(default_factory=dict)
    #: asset ids whose `[rig]` block has already been measured and written.
    #: Per asset, because a rig can target any view, not only the front one.
    rig_written: set = field(default_factory=set)

    @property
    def current(self) -> StepState | None:
        return next((s for s in self.steps if s.status in ("pending", "failed")), None)

    @property
    def done(self) -> bool:
        return all(s.status == "done" for s in self.steps)


# --------------------------------------------------------------------------
# page
# --------------------------------------------------------------------------

def render() -> None:
    store.reload()
    state = {"category": "character", "run": None}

    with ui.column().classes("w-full max-w-4xl mx-auto p-6 gap-4"):
        ui.label("새로 만들기").classes("text-2xl font-medium")

        @ui.refreshable
        def picker() -> None:
            # `items-stretch`: the hints are different lengths, so at w-44 they
            # wrap to a different number of lines per category and the cards end
            # up ragged. NiceGUI's row aligns children to flex-start, which sizes
            # each card to its own text.
            with ui.row().classes("gap-3 flex-wrap items-stretch"):
                for category in CATEGORIES:
                    selected = state["category"] == category
                    classes = "w-44 cursor-pointer transition-shadow hover:shadow-md"
                    if selected:
                        classes += " ring-2 ring-primary"
                    with ui.card().classes(classes).on(
                            "click", lambda c=category: _pick(c)):
                        with ui.row().classes("items-center gap-2"):
                            ui.icon(CATEGORY_ICONS[category], size="22px")
                            ui.label(CATEGORY_LABELS[category]).classes("font-medium")
                        ui.label(CATEGORY_HINTS[category]) \
                          .classes("text-xs text-gray-500 leading-snug")

        def _pick(category: str) -> None:
            state["category"] = category
            state["run"] = None
            picker.refresh()
            form.refresh()

        picker()
        ui.separator()

        @ui.refreshable
        def form() -> None:
            if state["category"] == "character":
                _character_form(state)
            else:
                _single_form(state["category"])

        form()


# --------------------------------------------------------------------------
# shared form pieces
# --------------------------------------------------------------------------

def _reference_picker(reference: Reference, *, allow_asset: bool = True,
                      label: str = "레퍼런스 이미지 (선택)") -> None:
    """Four ways to hand the model a picture to copy from.

    Whatever is chosen ends up as bytes inside the asset's own directory before
    generation, because codex runs sandboxed at the repo root and cannot open a
    file that lives anywhere else.
    """
    ui.label(label).classes("text-sm font-medium mt-2")
    with ui.tabs().props("dense").classes("w-full") as tabs:
        ui.tab("none", label="없음")
        ui.tab("upload", label="파일 업로드")
        ui.tab("path", label="경로 입력")
        if allow_asset:
            ui.tab("asset", label="기존 에셋")
            ui.tab("candidate", label="이전 버전")

    def on_change(e) -> None:
        reference.kind = e.value
        if e.value == "none":
            reference.data, reference.text = None, ""

    tabs.on_value_change(on_change)

    with ui.tab_panels(tabs, value="none", animated=False).classes("w-full"):
        with ui.tab_panel("none"):
            ui.label("설명만으로 새로 그립니다.").classes("text-sm text-gray-500")

        with ui.tab_panel("upload"):
            def on_upload(e: events.UploadEventArguments) -> None:
                reference.kind = "upload"
                reference.data = e.content.read()
                reference.text = e.name
                ui.notify(f"{e.name} 첨부됨", type="positive")
            ui.upload(on_upload=on_upload, auto_upload=True) \
              .props('accept="image/*" flat').classes("w-full")

        with ui.tab_panel("path"):
            ui.input("이미지 파일 경로", placeholder="/Users/me/art/hero.png") \
              .props("outlined dense").classes("w-full") \
              .bind_value(reference, "text")
            ui.label("저장소 밖의 파일도 됩니다. 에셋 폴더 안으로 복사해서 씁니다.") \
              .classes("text-xs text-gray-500")

        if allow_asset:
            with ui.tab_panel("asset"):
                ids = sorted(a.id for a in store.assets if a.raw.exists())
                ui.select(ids, label="레퍼런스로 쓸 에셋", with_input=True) \
                  .props("outlined dense").classes("w-full") \
                  .bind_value(reference, "text")

            with ui.tab_panel("candidate"):
                _candidate_picker(reference)


def _candidate_picker(reference: Reference) -> None:
    owners = [a for a in store.assets if history.list_candidates(a)]
    if not owners:
        ui.label("보관된 이전 버전이 아직 없습니다.").classes("text-sm text-gray-500")
        return

    chosen = {"asset": owners[0].id}

    @ui.refreshable
    def grid() -> None:
        asset = store.by_id(chosen["asset"])
        items = history.list_candidates(asset) if asset else []
        with ui.row().classes("gap-3 flex-wrap mt-2"):
            for candidate in items:
                selected = (reference.kind == "candidate"
                            and reference.text == chosen["asset"]
                            and reference.candidate == candidate.n)
                classes = "w-32 cursor-pointer" + (" ring-2 ring-primary" if selected else "")
                with ui.card().classes(classes).on("click", lambda c=candidate: pick(c)):
                    pixel_image(file_url(c.raw) if (c := candidate) else "", 104)
                    ui.label(candidate.label).classes("text-xs truncate w-full")

    def pick(candidate) -> None:
        reference.kind = "candidate"
        reference.text = chosen["asset"]
        reference.candidate = candidate.n
        reference.data = candidate.raw.read_bytes()
        grid.refresh()

    def on_owner(e) -> None:
        chosen["asset"] = e.value
        grid.refresh()

    ui.select([a.id for a in owners], value=owners[0].id, label="에셋",
              on_change=on_owner).props("outlined dense").classes("w-full")
    grid()


def _overrides_panel(category: str, overrides: dict) -> None:
    with ui.expansion("고급 설정", icon="tune").classes("w-full"):
        ui.label("비워두면 pipeline.toml 의 카테고리 기본값을 씁니다.") \
          .classes("text-xs text-gray-500")
        with ui.row().classes("gap-4 flex-wrap items-start"):
            for key, (label, hint) in NUMERIC.items():
                with ui.column().classes("gap-0"):
                    ui.number(label, format="%d") \
                      .props("outlined dense clearable").style("width:200px") \
                      .bind_value(overrides, key)
                    if hint:
                        ui.label(hint).classes("text-xs text-gray-400")
            for key, (options, label) in CHOICES.items():
                ui.select([None] + options, label=label) \
                  .props("outlined dense clearable").style("width:200px") \
                  .bind_value(overrides, key)
        ui.input("키 컬러", placeholder="#00ff00") \
          .props("outlined dense clearable").style("width:200px") \
          .bind_value(overrides, "key_color")
        ui.label("피사체 자체가 초록색이면 #ff00ff 처럼 다른 색으로 바꾸세요. "
                 "안 그러면 배경과 함께 피사체까지 지워집니다.") \
          .classes("text-xs text-gray-400")


def _clean(overrides: dict) -> dict:
    """Drop blanks, and make numbers ints — TOML has no 64.0 for a canvas size."""
    out = {}
    for key, value in overrides.items():
        if value in (None, "", []):
            continue
        out[key] = int(value) if key in NUMERIC else value
    return out


def _install_reference(asset_dir: Path, reference: Reference) -> tuple[str, str]:
    """Put the reference where the sandboxed agent can reach it.

    Returns (reference_from, reference_file) for the spec — exactly one is set.
    """
    if not reference.is_set:
        return "", ""
    if reference.kind == "asset":
        return reference.text, ""

    dest = asset_dir / "work" / "ref_external.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if reference.data is not None:
        dest.write_bytes(reference.data)
    else:
        source = Path(reference.text).expanduser()
        if not source.is_file():
            raise RuntimeError(f"레퍼런스 파일을 찾을 수 없습니다: {source}")
        shutil.copyfile(source, dest)
    return "", "work/ref_external.png"


# --------------------------------------------------------------------------
# single asset (prop / icon / effect / tile)
# --------------------------------------------------------------------------

def _single_form(category: str) -> None:
    fields = {"id": "", "subject": ""}
    overrides: dict = {}
    reference = Reference()

    with ui.card().classes("w-full"):
        ui.input("에셋 id", placeholder="office_lamp") \
          .props("outlined dense").classes("w-full").bind_value(fields, "id")
        ui.label("소문자와 밑줄을 씁니다. 폴더 이름이 곧 id입니다.") \
          .classes("text-xs text-gray-500")

        ui.textarea("설명", placeholder=_placeholder(category)) \
          .props("outlined autogrow").classes("w-full mt-2") \
          .bind_value(fields, "subject")
        ui.label("생김새만 적으세요. 화풍·셰이딩·배경 규칙은 prompts/ 가 이미 정합니다.") \
          .classes("text-xs text-gray-500")

        # A tile is a full-bleed material with no subject to copy, so a reference
        # image would fight the seamless-wrap brief rather than help it.
        if category != "tile":
            _reference_picker(reference)
        _overrides_panel(category, overrides)

    console = LogConsole()
    console.log.classes("hidden")

    async def start() -> None:
        asset_id = (fields["id"] or "").strip()
        subject = (fields["subject"] or "").strip()
        if not asset_id or not subject:
            ui.notify("id와 설명을 모두 입력하세요", type="warning")
            return
        if store.by_id(asset_id):
            ui.notify(f"{asset_id} 는 이미 있습니다", type="warning")
            return

        console.log.classes(remove="hidden")
        console.clear()
        try:
            directory = ASSETS / category / asset_id
            ref_from, ref_file = _install_reference(directory, reference)
            text = R.render_spec(
                asset_id=asset_id, category=category, subject=subject,
                reference_from=ref_from, reference_file=ref_file,
                overrides=_clean(overrides))
            R.write_spec(asset_id, text, category)
            console.push(f"스펙 작성: {(directory / SPEC_NAME).relative_to(ROOT)}")

            await tasks.generate(asset_id, console.push)
            console.push("완료")
            ui.notify(f"{asset_id} 생성 완료", type="positive")
            preview.refresh()
        except Exception as err:                       # noqa: BLE001 - shown to the user
            console.push(f"실패: {err}")
            notify_error(err)

    ui.button(f"{CATEGORY_LABELS[category]} 만들기", icon="auto_awesome",
              on_click=start).props("unelevated size=lg")

    @ui.refreshable
    def preview() -> None:
        store.reload()
        asset = store.by_id((fields["id"] or "").strip())
        if asset is None:
            return
        with ui.card().classes("w-full"):
            ui.label("결과").classes("font-medium")
            from .state import stage_images
            from .widgets import stage_strip
            stage_strip(stage_images(asset), 140)
            ui.button("라이브러리에서 보기", icon="photo_library",
                      on_click=lambda: ui.navigate.to("/")).props("flat dense")

    preview()


def _placeholder(category: str) -> str:
    return {
        "prop": "a squat office filing cabinet with three drawers and a chunky handle",
        "icon": "a paper coffee cup with a lid and a cardboard sleeve",
        "effect": "a four-pointed impact burst with fat blunt spikes",
        "tile": "worn beige linoleum with a cross of slightly darker seams "
                "through the middle",
    }.get(category, "")


# --------------------------------------------------------------------------
# character: an ordered plan of five
# --------------------------------------------------------------------------

def _character_form(state: dict) -> None:
    preset = R.load_preset()
    base = R.base_of(preset)
    fields = {"group": "", "subject": ""}
    overrides: dict = {}
    reference = Reference()
    selected = {a.name: True for a in preset}

    with ui.card().classes("w-full"):
        ui.input("캐릭터 이름", placeholder="tired_officeworker") \
          .props("outlined dense").classes("w-full").bind_value(fields, "group")
        ui.label("이 이름이 정면 에셋의 id가 되고, 다른 뷰는 여기에 접미사가 붙습니다.") \
          .classes("text-xs text-gray-500")

        ui.textarea("캐릭터 설명 (정면 기준)",
                    placeholder="a completely burnt-out office worker in a wrinkled "
                                "white dress shirt, loosened navy tie, dark grey "
                                "slacks, messy spiky dark brown hair, both hands empty") \
          .props("outlined autogrow").classes("w-full mt-2").bind_value(fields, "subject")
        ui.label("정면 기준으로 한 번만 적으세요. 옆·뒤 뷰는 "
                 "'무엇이 안 보이는지'만 프리셋이 덧붙입니다.") \
          .classes("text-xs text-gray-500")

        _reference_picker(reference, label="레퍼런스 이미지 (선택) — 정면 생성에만 쓰입니다")
        _overrides_panel("character", overrides)

    with ui.card().classes("w-full"):
        ui.label("만들 애니메이션").classes("font-medium")
        ui.label("정면(대기)은 나머지 전부의 레퍼런스이자 팔레트 원본이라 항상 먼저 만듭니다.") \
          .classes("text-xs text-gray-500 mb-2")
        for animation in preset:
            with ui.row().classes("items-center gap-2 w-full"):
                checkbox = ui.checkbox(value=True).props("dense")
                checkbox.on_value_change(
                    lambda e, n=animation.name: selected.__setitem__(n, e.value))
                if animation.is_base:
                    checkbox.set_value(True)
                    checkbox.disable()
                ui.label(animation.label).classes("font-medium w-28")
                kind = "시트 생성" if animation.kind == "sheet" else "리깅 합성"
                colour = "indigo" if animation.kind == "sheet" else "teal"
                ui.chip(kind, color=colour).props("dense text-color=white").classes("text-xs")
                ui.label(_step_note(animation, base)).classes("text-xs text-gray-500")

    def start() -> None:
        group = (fields["group"] or "").strip()
        subject = (fields["subject"] or "").strip()
        if not group or not subject:
            ui.notify("이름과 설명을 모두 입력하세요", type="warning")
            return
        chosen = {name for name, on in selected.items() if on}
        chosen.add(base.name)
        plan = R.plan(group, preset, chosen, reference.is_set)
        state["run"] = Run(group=group, subject=subject,
                           overrides=_clean(overrides), reference=reference,
                           preset=preset,
                           steps=[StepState(step) for step in plan])
        runner.refresh()

    ui.button("캐릭터 만들기", icon="auto_awesome", on_click=start) \
      .props("unelevated size=lg")

    @ui.refreshable
    def runner() -> None:
        if state["run"] is not None:
            _runner(state["run"])

    runner()


def _step_note(animation, base) -> str:
    if animation.kind == "rig":
        # Not every clip moves the legs — a hurt shake moves the reserved `body`
        # part and nothing else, so name what the preset actually declares.
        moved = ", ".join(animation.needs_parts) if animation.needs_parts else "몸 전체"
        return f"{base.label} 스프라이트에서 {moved} 이동 · 모델 호출 없음"
    if animation.is_base:
        return "정면 시트 · 이 캐릭터의 원본"
    return f"{base.label} 정면을 레퍼런스로 시트 생성"


def _runner(run_state: Run) -> None:
    # Hidden until there is something to say: an empty black box above the plan
    # reads as a broken panel rather than as a console waiting for output.
    console = LogConsole("200px")
    console.log.classes("hidden")

    with ui.card().classes("w-full"):
        ui.label(f"{run_state.group} — 진행").classes("text-lg font-medium")
        ui.label(f"레퍼런스: {run_state.reference.describe()}") \
          .classes("text-xs text-gray-500")

        @ui.refreshable
        def rows() -> None:
            store.reload()
            for i, item in enumerate(run_state.steps, 1):
                icon, colour = {
                    "pending": ("radio_button_unchecked", "text-gray-400"),
                    "running": ("hourglass_top", "text-blue-500"),
                    "done": ("check_circle", "text-green-600"),
                    "failed": ("error", "text-red-600"),
                }[item.status]
                with ui.row().classes("items-center gap-3 w-full py-1"):
                    ui.icon(icon, size="20px").classes(colour)
                    ui.label(f"{i}. {item.step.animation.label}").classes("w-28 font-medium")
                    ui.label(item.step.asset_id).classes("text-sm text-gray-500 w-40 truncate")
                    asset = store.by_id(item.step.asset_id)
                    if item.status == "done" and asset is not None:
                        pixel_image(thumbnail(asset), 48)
                    if item.message:
                        ui.label(item.message).classes("text-xs text-red-600")

        rows()
        ui.separator()

        # Built once and then updated in place, never re-rendered. Refreshing
        # this row would delete the very button whose click handler is running,
        # and every UI call after the await would fail with a deleted slot.
        last_done: dict = {"step": None}
        with ui.row().classes("gap-2 items-center"):
            run_button = ui.button("", icon="play_arrow").props("unelevated")
            redo_button = ui.button("", icon="autorenew").props("flat")
            hint = ui.label("한 단계씩 진행합니다. 결과를 보고 다음을 실행하세요.") \
                     .classes("text-xs text-gray-500")
        with ui.row().classes("gap-2 items-center") as finished:
            ui.label("5종 모두 완료했습니다.").classes("text-green-700 font-medium")
            ui.button("라이브러리에서 보기", icon="photo_library",
                      on_click=lambda: ui.navigate.to("/")).props("unelevated")
            ui.button("아틀라스 빌드", icon="build",
                      on_click=lambda: ui.navigate.to("/build")).props("outline")

        def sync(busy: bool = False) -> None:
            finished.set_visibility(run_state.done)
            hint.set_visibility(not run_state.done)
            current = run_state.current
            run_button.set_visibility(current is not None)
            if current is not None:
                verb = "다시 시도" if current.status == "failed" else "실행"
                run_button.set_text(f"{current.step.animation.label} {verb}")
            done = [s for s in run_state.steps if s.status == "done"]
            last_done["step"] = done[-1] if done else None
            redo_button.set_visibility(bool(done) and not busy)
            if done:
                redo_button.set_text(f"{done[-1].step.animation.label} 재생성")
            run_button.set_enabled(not busy)

        run_button.on_click(lambda: _go(run_state, console, rows, sync))
        redo_button.on_click(
            lambda: _redo(run_state, last_done["step"], console, rows, sync))
        sync()


async def _step(run_state: Run, item: StepState, console: LogConsole,
                rows, sync, verb: str) -> None:
    """Run one plan step and keep the panel honest about how it went.

    Awaited straight from the click handler rather than deferred to a `ui.timer`,
    which would be created in a slot this function then invalidates and so would
    never fire. `rows` is a sibling container and is safe to refresh; the button
    row is only ever updated in place, by `sync`.
    """
    item.status, item.message = "running", ""
    console.log.classes(remove="hidden")
    console.clear()
    rows.refresh()
    sync(busy=True)
    try:
        await _execute(run_state, item, console.push)
        item.status = "done"
        ui.notify(f"{item.step.animation.label} {verb}완료", type="positive")
    except Exception as err:                           # noqa: BLE001 - shown to the user
        item.status, item.message = "failed", str(err)[:200]
        console.push(f"실패: {err}")
        notify_error(err)
    finally:
        store.reload()
        rows.refresh()
        sync()


async def _go(run_state: Run, console: LogConsole, rows, sync) -> None:
    item = run_state.current
    if item is not None:
        await _step(run_state, item, console, rows, sync, "")


async def _redo(run_state: Run, item: StepState | None, console: LogConsole,
                rows, sync) -> None:
    if item is not None:
        await _step(run_state, item, console, rows, sync, "재생성 ")


async def _execute(run_state: Run, item: StepState, on_log) -> None:
    animation = item.step.animation
    base = R.base_of(run_state.preset)

    if animation.kind == "rig":
        await _run_rig_step(run_state, animation, base, on_log)
        return

    directory = ASSETS / "character" / item.step.asset_id
    if animation.is_base:
        # The rig block is written later, once the sprite exists and the leg
        # rectangles can actually be measured off it.
        ref_from, ref_file = _install_reference(directory, run_state.reference)
        text = R.base_spec(run_state.group, run_state.subject, animation,
                           run_state.overrides, ref_file, ref_from)
    else:
        text = R.view_spec(run_state.group, run_state.subject, animation, base,
                           run_state.overrides)
    R.write_spec(item.step.asset_id, text)
    on_log(f"[{animation.label}] 스펙 작성 완료")

    await tasks.generate(item.step.asset_id, on_log)


async def _run_rig_step(run_state: Run, animation, base, on_log) -> None:
    """Cut rectangles out of the target's sprite and compose the clip.

    The target is usually the front view, but not always: a standing pose is
    drawn once and bounced, so its clip is cut from its own sprite. The
    rectangles are measured off whichever sprite that is and written into that
    asset's spec together with every clip it owns, so the spec is never in a
    state where a clip refers to a part that is not defined yet.
    """
    target = next(a for a in run_state.preset if a.name == animation.target)
    target_id = target.asset_id(run_state.group)
    store.reload()
    asset = store.by_id(target_id)
    if asset is None:
        raise RuntimeError(f"{target_id}: {target.label} 에셋을 먼저 만들어야 합니다")

    sprite = P.sprite_path(asset, 0)
    if not sprite.exists():
        raise RuntimeError(
            f"{target_id}: 픽셀 스프라이트가 없습니다. {target.label}을 먼저 완료하세요."
        )

    if target_id not in run_state.rig_written:
        from PIL import Image
        selected = {s.step.animation.name for s in run_state.steps}
        guess = rig_mod.suggest_parts(Image.open(sprite).convert("RGBA"))
        wanted = R.required_parts(run_state.preset, target.name, selected)
        missing = [p for p in wanted if p not in guess]
        if missing:
            # A silent fallback here would produce a clip where nothing moves,
            # which looks like a pipeline bug rather than a bad guess.
            raise RuntimeError(
                f"{target_id}: 스프라이트에서 파트를 찾지 못했습니다 ({', '.join(missing)}). "
                f"assets/character/{target_id}/asset.toml 의 [rig] parts 를 직접 지정한 뒤 "
                f"라이브러리에서 '픽셀화 다시'를 실행하세요."
            )
        parts = {k: v for k, v in guess.items() if k in wanted}
        clips = R.rig_clips(run_state.preset, selected).get(target.name, [])

        # Rewritten in full rather than appended to, so whatever reference the
        # asset was drawn from survives the rig block being added.
        if target.is_base:
            run_state.parts = parts
            text = R.base_spec(run_state.group, run_state.subject, target,
                               overrides=run_state.overrides,
                               reference_file=asset.reference_file,
                               reference_from=asset.reference_from,
                               parts=parts, clips=clips)
        else:
            text = R.view_spec(run_state.group, run_state.subject, target, base,
                               overrides=run_state.overrides,
                               parts=parts, clips=clips)
        R.write_spec(target_id, text)
        run_state.rig_written.add(target_id)
        rects = ", ".join(f"{n}={list(b)}" for n, b in sorted(parts.items()))
        on_log(f"[{target.label}] 리그 파트 자동 추정: {rects}")

    store.reload()
    asset = store.by_id(target_id)
    written = await run.io_bound(P.run_rig, asset, store.config, animation.clip)
    for name, paths in written.items():
        on_log(f"[{animation.label}] 클립 {name}: {len(paths)}프레임 합성")

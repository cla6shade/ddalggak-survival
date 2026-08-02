"""Stage 1: hand the prompt to `codex exec` and make sure a raw PNG lands on disk.

Asynchronous, because a single call can legitimately take minutes and the UI has
to stay alive and show what is happening. The raw JSONL event stream is still
written to `work/events.jsonl` exactly as before — it is the only record of what
the agent actually did, and `_recover_from_events` reads it back when the agent
saves the image somewhere unexpected. What goes to `on_log` is a summary for a
human watching a panel, never a substitute for that file.
"""

from __future__ import annotations

import asyncio
import json
import re
import shutil
from pathlib import Path
from typing import Callable

from . import prompt as prompt_mod
from . import tools
from .spec import ROOT, Asset

# codex's --json stream has no image_generation event, but the agent's own `cp`
# shows up as a command_execution item, so the generated file is recoverable
# from there when the agent copies it somewhere unexpected.
GENERATED_RE = re.compile(r"(/\S*/generated_images/\S+?\.png)")

Logger = Callable[[str], None]


def _recover_from_events(events_file: Path) -> Path | None:
    if not events_file.exists():
        return None
    candidates: list[Path] = []
    for line in events_file.read_text().splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        for match in GENERATED_RE.findall(json.dumps(event)):
            path = Path(match)
            if path.exists():
                candidates.append(path)
    return candidates[-1] if candidates else None


def _shorten(text: str, limit: int = 160) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def summarize(line: str) -> str | None:
    """One human-readable line for a raw event, or None for events not worth showing.

    Unparseable output is passed through rather than dropped: when codex fails it
    tends to fail by printing something that is not an event at all, and that is
    exactly the line worth seeing.
    """
    line = line.strip()
    if not line:
        return None
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        return _shorten(line)

    kind = event.get("type")
    item = event.get("item") or {}
    item_kind = item.get("type")

    if kind == "thread.started":
        return "codex 세션 시작"
    if kind == "item.started" and item_kind == "command_execution":
        return f"$ {_shorten(item.get('command', ''), 120)}"
    if kind == "item.completed" and item_kind == "agent_message":
        return _shorten(item.get("text", ""))
    if kind == "turn.completed":
        usage = event.get("usage") or {}
        return (f"완료 (입력 {usage.get('input_tokens', 0):,} / "
                f"출력 {usage.get('output_tokens', 0):,} 토큰)")
    if kind == "error" or item_kind == "error":
        return f"오류: {_shorten(json.dumps(event.get('message') or event, ensure_ascii=False))}"
    return None


async def _drain(stream: asyncio.StreamReader, events_file: Path,
                 on_log: Logger | None) -> None:
    """Copy the event stream to disk verbatim, and a summary of it to the log."""
    with events_file.open("wb") as out:
        async for raw in stream:
            out.write(raw)
            out.flush()          # so a crashed run still leaves a readable file
            if on_log is None:
                continue
            note = summarize(raw.decode(errors="replace"))
            if note:
                on_log(note)


async def generate(asset: Asset, config: dict, on_log: Logger | None = None,
                   edit_request: str | None = None) -> str:
    """Write the prompt, run codex, return the prompt text that was used.

    With `edit_request` the asset's current `raw.png` is both the reference and
    the destination, so callers must snapshot it first — see `history.snapshot`.
    """
    text = prompt_mod.build(asset, edit_request)
    asset.prompt_file.parent.mkdir(parents=True, exist_ok=True)
    asset.prompt_file.write_text(text)

    reference = asset.raw if edit_request else asset.reference_image
    if reference is not None and not reference.exists():
        raise RuntimeError(
            f"{asset.id}: the reference image {reference.relative_to(ROOT)} does not "
            f"exist, so codex has nothing to open."
        )

    asset.raw.parent.mkdir(parents=True, exist_ok=True)
    events_file, last_file = asset.events_file, asset.last_file
    codex = config.get("codex", {})
    timeout = codex.get("timeout_sec", 900)

    cmd = [
        tools.find("codex", codex.get("path", "")), "exec", "--json",
        "--skip-git-repo-check",                       # this tree is not a git repo
        "--sandbox", codex.get("sandbox", "workspace-write"),
        "-o", str(last_file),
        "-",
    ]

    with asset.prompt_file.open("rb") as stdin:
        proc = await asyncio.create_subprocess_exec(
            *cmd, cwd=ROOT, stdin=stdin,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )

    stderr_chunks: list[bytes] = []

    async def collect_stderr() -> None:
        async for raw in proc.stderr:
            stderr_chunks.append(raw)

    try:
        await asyncio.wait_for(
            asyncio.gather(_drain(proc.stdout, events_file, on_log),
                           collect_stderr(),
                           proc.wait()),
            timeout=timeout,
        )
    finally:
        # Never leave the subprocess behind — on timeout, on cancellation from the
        # UI, or on any error. It holds a model call open, and a second attempt
        # would otherwise race the first one writing the same raw.png.
        if proc.returncode is None:
            proc.kill()
            await proc.wait()

    if not asset.raw.exists():
        recovered = _recover_from_events(events_file)
        if recovered is None:
            stderr = b"".join(stderr_chunks).decode(errors="replace").strip()
            raise RuntimeError(
                f"{asset.id}: codex exited {proc.returncode} and produced no image. "
                f"See {events_file}. stderr: {stderr[-500:]}"
            )
        if on_log:
            on_log(f"에이전트가 다른 경로에 저장함 — {recovered} 에서 복구")
        shutil.copyfile(recovered, asset.raw)

    return text

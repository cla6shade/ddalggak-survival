"""Finding `codex`, the one command-line tool the pipeline still shells out to.

It cannot be bundled — it is an authenticated CLI the user installs and logs into
— so it has to be found at runtime, and finding it is not as simple as naming it.

An app launched from the Finder inherits a bare PATH: `/usr/bin:/bin:/usr/sbin:
/sbin`, and nothing else. Homebrew's bin is not on it, nor is `~/.local/bin`.
That is why a tool that runs perfectly from a terminal fails the moment the same
code is double-clicked, with a `FileNotFoundError` that names the tool and
explains nothing. So: search the usual install locations, and if that still comes
up empty, ask the user's login shell what its PATH would have been.
"""

from __future__ import annotations

import functools
import os
import shutil
import subprocess
from pathlib import Path

# Where codex actually gets installed, in rough order of likelihood.
EXTRA_PATHS = ("/opt/homebrew/bin", "/usr/local/bin", "~/.local/bin",
               "~/.bun/bin", "~/.cargo/bin", "~/.npm-global/bin")


@functools.lru_cache(maxsize=1)
def _shell_path() -> str:
    """The PATH a login shell would build.

    Costs a shell startup, so it is the fallback rather than the first move — but
    it is the one thing that finds an install in an unusual place.
    """
    shell = os.environ.get("SHELL") or "/bin/zsh"
    try:
        done = subprocess.run([shell, "-lic", 'printf %s "$PATH"'],
                              capture_output=True, text=True, timeout=15, check=False)
    except (OSError, subprocess.SubprocessError):
        return ""
    return done.stdout.strip()


@functools.lru_cache(maxsize=8)
def find(name: str, configured: str = "") -> str:
    """An absolute path to `name`, or a RuntimeError saying what to install.

    Absolute rather than the bare name: what resolves depends on how the app was
    launched, and that is exactly what the failure has to be able to say.
    """
    if configured:
        path = Path(configured).expanduser()
        if not path.exists():
            raise RuntimeError(f"pipeline.toml 이 가리키는 {path} 가 없습니다.")
        return str(path)

    search = os.pathsep.join([
        os.environ.get("PATH", ""),
        *(str(Path(p).expanduser()) for p in EXTRA_PATHS),
    ])
    found = shutil.which(name, path=search) or shutil.which(name, path=_shell_path())
    if found:
        return found

    raise RuntimeError(
        f"{name} 실행 파일을 찾지 못했습니다. 설치돼 있는데도 이 오류가 난다면 "
        f'pipeline.toml 에 [{name}] path = "…" 로 직접 지정하면 됩니다.'
    )

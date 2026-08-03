"""Shared app state and the small conversions the UI needs from the core.

This is a single-user local tool, so the loaded specs live in one module-level
object rather than per-session. Anything that changes an asset on disk calls
`store.reload()` afterwards, because the specs are the source of truth and
holding a stale copy is how a UI ends up disagreeing with the file it edited.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from core import pipeline as P
from core.spec import ASSETS, Asset

DIST = P.DIST

# Where add_static_files mounts each tree, and the label a category shows as.
ASSET_MOUNT = "/asset-files"
DIST_MOUNT = "/dist-files"

CATEGORY_LABELS = {
    "character": "캐릭터",
    "prop": "사물",
    "icon": "아이콘",
    "effect": "이펙트",
    "tile": "타일",
    "background": "배경",
}
CATEGORY_ICONS = {
    "character": "person",
    "prop": "chair",
    "icon": "star",
    "effect": "auto_awesome",
    "tile": "grid_on",
    "background": "landscape",
}
CATEGORY_HINTS = {
    "character": "대기·앞걷기·뒤걷기·옆걷기·대미지 5종을 한 번에 만듭니다",
    "prop": "책상, 모니터, 의자 같은 월드 오브젝트",
    "icon": "인벤토리·UI 아이템 아이콘",
    "effect": "타격·획득 같은 VFX 스프라이트",
    "tile": "이음매 없이 반복되는 바닥 재질",
    "background": "화면 전체를 채우는 픽셀 환경 배경",
}


@dataclass
class Store:
    config: dict = field(default_factory=dict)
    assets: list[Asset] = field(default_factory=list)
    error: str = ""          # a malformed asset.toml is a typo, not a crash

    def reload(self) -> None:
        try:
            self.config, self.assets = P.load()
            self.error = ""
        except (ValueError, RuntimeError) as err:
            self.error = str(err)
            if not self.config:
                from core import spec as spec_mod
                self.config = spec_mod.load_config()

    def by_id(self, asset_id: str) -> Asset | None:
        return next((a for a in self.assets if a.id == asset_id), None)

    def in_category(self, category: str) -> list[Asset]:
        return [a for a in self.assets if a.category == category]

    def groups(self, category: str) -> tuple[dict[str, list[Asset]], list[Asset]]:
        """Assets bundled by `group`, plus the ones that belong to no group.

        Hand-written specs pre-date `group` and will never have one, so they are
        returned separately rather than each becoming a group of one — a heading
        reading "1개 뷰" over a single card is all frame and no information.
        """
        out: dict[str, list[Asset]] = {}
        loose: list[Asset] = []
        for asset in self.in_category(category):
            if asset.group:
                out.setdefault(asset.group, []).append(asset)
            else:
                loose.append(asset)
        return out, loose


store = Store()


# --------------------------------------------------------------------------
# turning a path into something an <img> can load
# --------------------------------------------------------------------------

def file_url(path: Path | None) -> str:
    """A URL for a file inside assets/ or dist/, or "" when there is nothing there.

    The modification time rides along as a query string. Without it the browser
    keeps showing the previous take after a regeneration, which makes a working
    pipeline look broken.
    """
    if path is None or not path.exists():
        return ""
    for root, mount in ((ASSETS, ASSET_MOUNT), (DIST, DIST_MOUNT)):
        try:
            rel = path.relative_to(root)
        except ValueError:
            continue
        return f"{mount}/{rel.as_posix()}?v={int(path.stat().st_mtime)}"
    return ""


def preview_scale(config: dict) -> int:
    return config.get("pixel", {}).get("preview_scale", 8)


def thumbnail(asset: Asset) -> str:
    """The best image available for an asset, falling back down the pipeline.

    The un-zoomed 64px sprite is preferred over the @8x file beside it. The
    browser scales it up with nearest-neighbour anyway, so the two look
    identical — but a grid of twenty assets is a few kilobytes instead of a few
    megabytes, which is the difference between the page appearing and the page
    loading.
    """
    for candidate in (P.sprite_path(asset, 0), asset.cut, asset.raw):
        url = file_url(candidate)
        if url:
            return url
    return ""


def stage_images(asset: Asset) -> list[tuple[str, str]]:
    """(label, url) for each intermediate the pipeline left behind, in order."""
    stages = [
        ("생성 (raw)", asset.raw),
        ("배경 분리 (cut)", asset.cut),
        ("픽셀화", P.sprite_path(asset, 0)),
    ]
    return [(label, file_url(path)) for label, path in stages if file_url(path)]

import type { AssetManager } from './AssetManager'
import type { AtlasFrame } from '@/generated/atlas'

/**
 * 아틀라스 프레임을 DOM 에서 쓸 수 있게 꺼냅니다.
 *
 * CSS 스프라이트(`background-position`)로도 되지만 프레임이 트림되어 있어서 여백 계산이
 * 프레임마다 다릅니다. 한 번씩 잘라 data URL 로 캐시하면 그 계산이 사라집니다.
 */
export class IconSheet {
  private readonly cache = new Map<AtlasFrame, string>()

  constructor(private readonly assets: AssetManager) {}

  /** 아직 안 잘랐으면 자르고, 잘라 둔 게 있으면 그걸 줍니다. 없는 프레임이면 `null`. */
  getUrl(frame: AtlasFrame): string | null {
    const cached = this.cache.get(frame)
    if (cached) return cached

    const entry = this.assets.getAtlasEntry(frame)
    if (!entry) return null

    const { image, region } = entry
    if (region.width <= 0 || region.height <= 0) return null

    // **보이는 그림만** 정사각형 한가운데에 놓습니다. 원본 32×32 상자를 그대로 쓰면
    // 트림 위치가 프레임마다 달라서, 같은 크기로 늘어놔도 아이콘이 제각기 치우칩니다.
    const size = Math.max(region.width, region.height)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      image,
      region.x,
      region.y,
      region.width,
      region.height,
      Math.round((size - region.width) / 2),
      Math.round((size - region.height) / 2),
      region.width,
      region.height,
    )

    const url = canvas.toDataURL()
    this.cache.set(frame, url)

    return url
  }
}

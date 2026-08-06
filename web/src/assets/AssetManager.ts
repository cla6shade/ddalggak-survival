import { AtlasAsset } from './AtlasAsset'
import type { AtlasEntry } from './AtlasAsset'
import { AnimationAsset } from './AnimationAsset'
import { loadImage } from './loader'
import { TILE_TEXTURES } from '@/generated/atlas'
import type { AnimKey, AtlasFrame, TileTexture } from '@/generated/atlas'

/** 게임이 쓰는 그림들을 한 번 불러와 들고 있는 곳. */
export class AssetManager {
  private atlas: AtlasAsset | null = null
  private animations: AnimationAsset | null = null
  private readonly tiles = new Map<TileTexture, HTMLImageElement>()

  get isLoaded(): boolean {
    return this.atlas !== null && this.animations !== null
  }

  async load(): Promise<void> {
    const [atlas, animations, ...tiles] = await Promise.all([
      AtlasAsset.load(),
      AnimationAsset.load(),
      // 타일은 아틀라스 밖 낱장 PNG 라 이름을 하나씩 불러야 합니다.
      ...TILE_TEXTURES.map((name) => loadImage(`tiles/${name}.png`)),
    ])

    this.atlas = atlas
    this.animations = animations
    TILE_TEXTURES.forEach((name, i) => {
      const image = tiles[i]
      if (image) this.tiles.set(name, image)
    })
  }

  /** 불러둔 아틀라스에서 키에 해당하는 이미지와 프레임 자리를 찾습니다. */
  getAtlasEntry(key: AtlasFrame): AtlasEntry | null {
    return this.atlas?.getEntry(key) ?? null
  }

  /** 애니메이션이 `time` 초만큼 재생됐을 때의 프레임을 찾습니다. */
  getAnimationFrame(key: AnimKey, time: number): AtlasFrame | null {
    return this.animations?.getFrameAt(key, time) ?? null
  }

  /** 불러둔 타일 이미지를 찾습니다. */
  getTileImage(name: TileTexture): HTMLImageElement | null {
    return this.tiles.get(name) ?? null
  }
}

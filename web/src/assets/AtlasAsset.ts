import { loadImage, loadJSON } from '../assets/loader'
import type { AtlasFrame } from '../generated/atlas'

const ATLAS_IMAGE = 'atlas.png'
const ATLAS_JSON = 'atlas.json'

/** 아틀라스 이미지 안에서 프레임 한 장이 차지하는 자리. */
export interface FrameRegion {
  /** 아틀라스 이미지 기준 좌상단 위치와 크기. 여백이 잘려 있어 원본보다 작습니다. */
  x: number
  y: number
  width: number
  height: number
  /** 원본 프레임 안에서 잘려나간 좌상단 여백. 그릴 때 다시 더해줘야 위치가 맞습니다. */
  offsetX: number
  offsetY: number
  /** 트림 전 원본 크기. 정렬 계산에 씁니다. */
  sourceWidth: number
  sourceHeight: number
}

/** 아틀라스 키 하나가 가리키는 것 — 어느 이미지의 어느 자리인가. */
export interface AtlasEntry {
  image: HTMLImageElement
  region: FrameRegion
}

/** `atlas.json` 에서 실제로 읽는 부분만. */
interface AtlasData {
  frames: Record<
    string,
    {
      frame: { x: number; y: number; w: number; h: number }
      spriteSourceSize: { x: number; y: number }
      sourceSize: { w: number; h: number }
    }
  >
}

/** 아틀라스 이미지 한 장과 그 안의 프레임 표. */
export class AtlasAsset {
  constructor(
    private readonly image: HTMLImageElement,
    private readonly regions: ReadonlyMap<string, FrameRegion>,
  ) {}

  /** 아틀라스 이미지와 프레임 표를 읽어 옵니다. */
  static async load(): Promise<AtlasAsset> {
    const [image, data] = await Promise.all([
      loadImage(ATLAS_IMAGE),
      loadJSON<AtlasData>(ATLAS_JSON),
    ])

    const regions = new Map<string, FrameRegion>()
    for (const [key, entry] of Object.entries(data.frames)) {
      regions.set(key, {
        x: entry.frame.x,
        y: entry.frame.y,
        width: entry.frame.w,
        height: entry.frame.h,
        offsetX: entry.spriteSourceSize.x,
        offsetY: entry.spriteSourceSize.y,
        sourceWidth: entry.sourceSize.w,
        sourceHeight: entry.sourceSize.h,
      })
    }

    return new AtlasAsset(image, regions)
  }

  /** 키에 해당하는 이미지와 프레임 자리. 없는 키면 `null`. */
  getEntry(key: AtlasFrame): AtlasEntry | null {
    const region = this.regions.get(key)
    return region ? { image: this.image, region } : null
  }

  has(key: AtlasFrame): boolean {
    return this.regions.has(key)
  }
}

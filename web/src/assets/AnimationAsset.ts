import { loadJSON } from './loader'
import type { AnimKey, AtlasFrame } from '@/generated/atlas'

const ANIMATIONS_JSON = 'animations.json'

/** `animations.json` 에서 실제로 읽는 부분만. */
interface AnimationData {
  anims: {
    key: string
    frames: { frame: string }[]
    frameRate: number
    /** -1 이면 무한 반복, 0 이면 한 번 재생하고 마지막 프레임에 멈춥니다. */
    repeat: number
  }[]
  globalTimeScale: number
}

interface Animation {
  frames: AtlasFrame[]
  frameRate: number
  repeat: number
}

/** 애니메이션 표. "이 애니메이션이 몇 초 흘렀을 때 어느 프레임인가"에 답합니다. */
export class AnimationAsset {
  constructor(
    private readonly animations: ReadonlyMap<string, Animation>,
    private readonly timeScale: number,
  ) {}

  static async load(): Promise<AnimationAsset> {
    const data = await loadJSON<AnimationData>(ANIMATIONS_JSON)

    const animations = new Map<string, Animation>()
    for (const entry of data.anims) {
      animations.set(entry.key, {
        frames: entry.frames.map((f) => f.frame as AtlasFrame),
        frameRate: entry.frameRate,
        repeat: entry.repeat,
      })
    }

    return new AnimationAsset(animations, data.globalTimeScale)
  }

  /** 재생을 시작한 지 `time` 초 지났을 때 보여야 할 프레임. */
  getFrameAt(key: AnimKey, time: number): AtlasFrame | null {
    const animation = this.animations.get(key)
    if (!animation || animation.frames.length === 0) return null

    const step = Math.floor(Math.max(time, 0) * animation.frameRate * this.timeScale)
    const last = animation.frames.length - 1
    const index = animation.repeat === -1 ? step % animation.frames.length : Math.min(step, last)

    return animation.frames[index] ?? null
  }
}

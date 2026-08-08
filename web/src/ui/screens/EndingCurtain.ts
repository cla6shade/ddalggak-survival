import { UiElement } from '../UiElement'
import type { AssetManager } from '@/assets/AssetManager'

/** 캐릭터 한 칸의 원본 크기(px). 아틀라스의 `sourceSize` 와 같습니다. */
const SPRITE_SIZE = 64

/** 결과를 펴기 전 이 화면이 머무는 시간(ms). */
const HOLD = 2600

/** 화면에 세우는 배율. 픽셀이 뭉개지지 않게 정수만 씁니다(64 × 3 = 192). */
const SCALE = 3

/** 재생할 애니메이션. 4프레임이고, 뒤로 갈수록 캐릭터가 주저앉습니다. */
const ANIMATION = 'end_character'

/**
 * 재생 속도를 늦추는 배수.
 *
 * 아틀라스에 적힌 6fps 를 그대로 쓰면 4프레임이 0.7초 만에 지나가 후드득 무너집니다.
 * 0.25 를 곱해 1.5fps 로 늦추면 {@link HOLD} 안에 딱 한 번 주저앉습니다 —
 * 되감겨 다시 일어서는 꼴을 안 보이려면 한 바퀴를 넘기지 않아야 합니다.
 */
const TIME_SCALE = 0.25

/**
 * 판이 끝난 직후, 결과를 펴기 전에 잠깐 서는 화면.
 *
 * 숫자를 바로 들이밀면 방금 무슨 일이 있었는지 삼킬 틈이 없습니다. 방은 그대로
 * 두고 그 위를 덮어, **끝났다는 사실 하나만** 먼저 보여 줍니다. 캐릭터는 책상에
 * 엎어진 채로 계속 움직입니다 — 멈춘 그림이면 게임이 멎은 것처럼 보입니다.
 *
 * 스프라이트를 `IconSheet` 로 꺼내지 않고 캔버스에 직접 그립니다. 프레임마다
 * 여백이 다르게 잘려 있어서(44×64, 50×39 …) 잘라 놓은 정사각형을 이어 붙이면
 * 캐릭터가 매 프레임 튑니다. 원본 64×64 자리에 offset 을 더해 그려야 제자리에 섭니다.
 */
export class EndingCurtain extends UiElement<'section'> {
  private readonly canvas = document.createElement('canvas')
  private readonly context: CanvasRenderingContext2D | null

  private startedAt = 0
  private rafId = 0
  private timerId = 0
  /** 끝난 뒤에 부를 것. 한 번만 부르려고 부르고 나서 비웁니다. */
  private onDone: (() => void) | null = null

  constructor(private readonly assets: AssetManager) {
    super('section', 'curtain curtain--hidden')
    this.element.setAttribute('role', 'presentation')
    this.element.setAttribute('aria-hidden', 'true')

    const title = document.createElement('p')
    title.className = 'curtain__title'
    title.textContent = '망함...'

    this.canvas.className = 'curtain__character'
    this.canvas.width = SPRITE_SIZE
    this.canvas.height = SPRITE_SIZE
    this.canvas.style.width = `${SPRITE_SIZE * SCALE}px`
    this.canvas.style.height = `${SPRITE_SIZE * SCALE}px`

    this.context = this.canvas.getContext('2d')
    if (this.context) this.context.imageSmoothingEnabled = false

    this.element.append(title, this.canvas)
    // 기다리기 싫은 사람은 눌러서 건너뜁니다. 두 번 눌러도 한 번만 넘어갑니다.
    this.element.addEventListener('click', () => this.finish())
  }

  /** 화면을 세우고, 다 보고 나면 `onDone` 을 부릅니다. */
  show(onDone: () => void): void {
    this.onDone = onDone
    this.startedAt = performance.now()
    this.toggleClass('curtain--hidden', false)

    this.rafId = requestAnimationFrame(this.draw)
    this.timerId = window.setTimeout(() => this.finish(), HOLD)
  }

  /** 걷고 다음으로 넘깁니다. 이미 걷혔으면 아무 일도 하지 않습니다. */
  private finish(): void {
    const done = this.onDone
    if (!done) return
    this.onDone = null

    cancelAnimationFrame(this.rafId)
    window.clearTimeout(this.timerId)
    this.toggleClass('curtain--hidden', true)

    done()
  }

  /**
   * 지금 프레임을 그립니다.
   *
   * `offsetX`/`offsetY` 는 트림하면서 잘려 나간 여백입니다. 다시 더해 줘야
   * 프레임마다 다른 크기로 잘린 그림이 원본 64×64 안의 제자리에 섭니다.
   */
  private readonly draw = (now: number): void => {
    const context = this.context
    if (!context) return

    const elapsed = ((now - this.startedAt) / 1000) * TIME_SCALE
    const frame = this.assets.getAnimationFrame(ANIMATION, elapsed)
    const entry = frame ? this.assets.getAtlasEntry(frame) : null

    context.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
    if (entry) {
      const { image, region } = entry
      context.drawImage(
        image,
        region.x,
        region.y,
        region.width,
        region.height,
        region.offsetX,
        region.offsetY,
        region.width,
        region.height,
      )
    }

    this.rafId = requestAnimationFrame(this.draw)
  }
}

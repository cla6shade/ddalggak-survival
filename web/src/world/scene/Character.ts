import { Collidable } from '../base/Collidable'
import { Navigation } from '../Navigation'
import { WorldObject } from '../base/WorldObject'
import { isFlipped, isSideFacing } from '../geometry/facing'
import type { FootPrint } from '../Navigation'
import type { Facing } from '../geometry/facing'
import type { World } from '../World'
import type { Point } from '../geometry/Point'
import type { Rect } from '../geometry/Rect'
import { session } from '@/core/Session'
import type { Drawable } from '@/core/Drawable'
import type { Updatable } from '@/core/Updatable'
import type { AnimKey } from '@/generated/atlas'

/** 지금 뭘 하고 있는지. 그릴 애니메이션을 고르는 기준입니다. */
export type CharacterMotion = 'idle' | 'walk'

/** 이보다 가까우면 그 축은 다 온 것으로 봅니다. */
const ARRIVED = 0.01

/** 바닥에서 차지하는 면의 절반. 충돌 상자의 크기이자 길찾기가 장애물을 부풀릴 폭입니다. */
const FOOT: FootPrint = { halfWidth: 8, halfDepth: 3 }

/** 걷는 속도 (방 좌표 단위/초). */
const WALK_SPEED = 135

const ANIMATIONS: Record<'front' | 'back' | 'side', Record<CharacterMotion, AnimKey>> = {
  front: { idle: 'founder', walk: 'founder_walk' },
  back: { idle: 'founder_backidle_breathe', walk: 'founder_backwalk' },
  side: { idle: 'founder_sideidle_breathe', walk: 'founder_sidewalk' },
}

/**
 * 방 안을 돌아다니는 사람 하나. `(x, y)` 는 발밑입니다.
 * 어디로 어떻게 갈지는 걷는 쪽의 일이라, 길찾기 격자도 여기서 들고 있습니다.
 */
export class Character extends Collidable implements Drawable, Updatable {
  facing: Facing = 'front'
  motion: CharacterMotion = 'idle'

  /** 지금 재생 중인 애니메이션과, 그게 시작된 시각(세션 경과 초). */
  private animation: AnimKey | null = null
  private animationStartedAt = 0

  /** 어디까지 갈 수 있는지 물어볼 방. */
  private readonly world: World

  /** 바닥 격자. 처음 걸을 때 세웁니다. */
  private navigation: Navigation | null = null

  /** 남은 웨이포인트와, 다 가면 상호작용할 물건. */
  private path: Point[] = []
  private destination: WorldObject | null = null

  /** 도착한 뒤에 할 일. 걸어가는 것 자체가 조건인 행동을 여기 실어 보냅니다. */
  private arrivalTask: (() => void) | null = null

  constructor(world: World, x: number, y: number) {
    super(x, y, FOOT.halfWidth * 2, FOOT.halfDepth * 2)
    this.world = world
  }

  /** 방이 바뀌면 부릅니다. 다음 걸음 때 격자를 다시 세웁니다. */
  rebuildNavigation(): void {
    this.navigation = null
  }

  /**
   * 그 물건 앞으로 걸어갑니다. 가는 중에 다시 부르면 목적지가 바뀝니다.
   * `task` 는 도착한 뒤에 실행됩니다.
   */
  approach(object: WorldObject, task?: () => void): void {
    const navigation = this.ensureNavigation()
    const from = navigation.findNearestWalkable(this)
    const to = navigation.findNearestWalkable(object.stand)
    const path = navigation.findPath(from, to)

    // 길이 없으면 가지 않습니다. 도착 지점만 넣어 직선으로 가면
    // 그 구간이 장애물을 그대로 가로지릅니다.
    // 대신 들려 보낸 일은 그 자리에서 해치웁니다 — 누른 것을 삼켜버리면 안 됩니다.
    if (path.length === 0) {
      task?.()
      return
    }

    this.path = path
    this.destination = object
    this.arrivalTask = task ?? null
  }

  /** 걸어가던 걸 그만둡니다. */
  halt(): void {
    this.path = []
    this.destination = null
    this.arrivalTask = null
    this.motion = 'idle'
  }

  update(delta: number): void {
    if (this.path.length === 0) return

    let budget = WALK_SPEED * delta

    while (budget > 0 && this.path.length > 0) {
      const target = this.path[0] as Point
      const dx = target.x - this.x
      const dy = target.y - this.y

      // 웨이포인트마다 가로를 먼저 맞추고 그다음 세로. 대각선으로 걷지 않습니다.
      if (Math.abs(dx) > ARRIVED) {
        const step = Math.sign(dx) * Math.min(Math.abs(dx), budget)
        this.x += step
        budget -= Math.abs(step)
        this.setFacingTo(step, 0)
      } else if (Math.abs(dy) > ARRIVED) {
        const step = Math.sign(dy) * Math.min(Math.abs(dy), budget)
        this.y += step
        budget -= Math.abs(step)
        this.setFacingTo(0, step)
      } else {
        this.x = target.x
        this.y = target.y
        this.path.shift()
      }
    }

    if (this.path.length === 0) this.onArrive()
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const now = session.canvas?.elapsed ?? 0
    const animation = this.getAnimationKey()

    // 동작이나 방향이 바뀌면 처음부터 다시 재생합니다.
    if (animation !== this.animation) {
      this.animation = animation
      this.animationStartedAt = now
    }

    const key = session.assets.getAnimationFrame(animation, now - this.animationStartedAt)
    if (!key) return

    const entry = session.assets.getAtlasEntry(key)
    if (!entry) return

    const { image, region } = entry
    // 원본 프레임의 가로 한가운데·아래끝을 발밑에 맞춘 뒤,
    // 잘려나간 여백을 더해 트림 전 자리로 되돌립니다.
    const originX = this.x - region.sourceWidth / 2
    const originY = this.y - region.sourceHeight
    const flipped = isFlipped(this.facing)

    if (flipped) {
      ctx.save()
      // 발밑을 축으로 뒤집으면 서 있는 자리가 그대로 유지됩니다.
      ctx.translate(this.x, 0)
      ctx.scale(-1, 1)
      ctx.translate(-this.x, 0)
    }

    ctx.drawImage(
      image,
      region.x,
      region.y,
      region.width,
      region.height,
      originX + region.offsetX,
      originY + region.offsetY,
      region.width,
      region.height,
    )

    if (flipped) ctx.restore()
  }

  /** 바닥 사각형과 물건들이 막는 면으로 격자를 세웁니다. */
  private ensureNavigation(): Navigation {
    if (this.navigation) return this.navigation

    const blockers = this.world.pieces
      .filter((piece): piece is WorldObject => piece instanceof WorldObject)
      .map((object) => object.footprint)
      .filter((footprint): footprint is Rect => footprint !== null)

    this.navigation = new Navigation(this.world.floor, blockers, FOOT)

    return this.navigation
  }

  /** 다 갔습니다. 정해 둔 쪽을 보고 서서, 그 물건과 상호작용합니다. */
  private onArrive(): void {
    const destination = this.destination
    const task = this.arrivalTask
    this.destination = null
    this.arrivalTask = null
    this.motion = 'idle'

    if (destination) {
      this.facing = destination.stand.facing
      destination.onInteract()
    }
    task?.()
  }

  /** 지금 움직이는 축으로 바라보는 쪽을 정합니다. */
  private setFacingTo(dx: number, dy: number): void {
    this.motion = 'walk'
    this.facing =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'back' : 'front'
  }

  /** 방향과 동작으로 애니메이션 하나를 고릅니다. */
  private getAnimationKey(): AnimKey {
    const direction = isSideFacing(this.facing)
      ? 'side'
      : this.facing === 'back'
        ? 'back'
        : 'front'

    return ANIMATIONS[direction][this.motion]
  }
}

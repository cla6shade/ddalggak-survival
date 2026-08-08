import { Collidable } from './Collidable'
import { session } from '@/core/Session'
import type { StandSpot } from './StandSpot'
import type { Point } from '../geometry/Point'
import type { Rect } from '../geometry/Rect'
import type { Drawable } from '@/core/Drawable'
import type { AtlasFrame } from '@/generated/atlas'

/** 도착 표시 타원의 반지름. */
const STAND_RADIUS_X = 12
const STAND_RADIUS_Y = 4

/**
 * 방에 놓인 물건. 자리와 충돌 상자는 `Collidable` 이 주고, 여기서는 그리는 법과
 * 상호작용만 더합니다.
 *
 * `Collidable` 상자는 **누르는 자리** 입니다 — 트림된 그림 크기 그대로.
 * 걸어서 막히는 면은 `footprint` 로 따로 두며, 벽걸이처럼 `null` 일 수 있습니다.
 */
export class WorldObject extends Collidable implements Drawable {
  readonly frame: AtlasFrame
  readonly stand: StandSpot
  /** 걸어서 막히는 면 (방 좌표 절대값). 벽걸이는 `null`. */
  readonly footprint: Rect | null
  /** 그림만 밀어서 그리는 값. 누르는 자리·막는 면·도착 위치는 그대로입니다. */
  readonly drawOffset: Point
  /**
   * 아래 좌표들이 기준으로 삼은 스프라이트 캔버스 크기.
   *
   * 같은 물건을 더 큰 캔버스에 다시 그려 넣으면 아틀라스 프레임만 커지는데,
   * 방 좌표는 그대로여야 합니다. 그래서 방에 놓을 때 이 값에 맞춰 줄여 그립니다 —
   * 예전 64 캔버스 그림을 160 으로 다시 그리면 0.4 배로 놓입니다.
   */
  readonly canvas: number

  constructor(
    frame: AtlasFrame,
    x: number,
    y: number,
    width: number,
    height: number,
    stand: StandSpot,
    footprint: Rect | null = null,
    drawOffset: Point = { x: 0, y: 0 },
    canvas = 0,
  ) {
    super(x, y, width, height)
    this.frame = frame
    this.stand = stand
    this.footprint = footprint
    this.drawOffset = drawOffset
    this.canvas = canvas
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const entry = session.assets.getAtlasEntry(this.frame)
    if (!entry) return

    const { image, region } = entry
    // 그림이 기준 캔버스보다 크게 들어오면 그만큼 줄입니다. `canvas` 가 0 이면
    // 원본 크기 그대로입니다.
    const scale = this.canvas > 0 ? this.canvas / region.sourceHeight : 1
    // 원본 프레임의 가로 한가운데·아래끝을 발밑에 맞춘 뒤,
    // 잘려나간 여백을 더해 트림 전 자리로 되돌립니다.
    const originX = this.x - (region.sourceWidth * scale) / 2 + this.drawOffset.x
    const originY = this.y - region.sourceHeight * scale + this.drawOffset.y

    ctx.drawImage(
      image,
      region.x,
      region.y,
      region.width,
      region.height,
      originX + region.offsetX * scale,
      originY + region.offsetY * scale,
      region.width * scale,
      region.height * scale,
    )
  }

  /** 도착 위치에 얇은 타원을 그려 "여기 서면 됩니다" 를 표시합니다. */
  drawStand(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(
      this.stand.x + this.drawOffset.x,
      this.stand.y + this.drawOffset.y,
      STAND_RADIUS_X,
      STAND_RADIUS_Y,
      0,
      0,
      Math.PI * 2,
    )
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  /** 도착 표시 안을 눌렀는지. 그림과 함께 이 자리도 누르는 자리입니다. */
  containsStand(x: number, y: number): boolean {
    const dx = (x - this.stand.x) / STAND_RADIUS_X
    const dy = (y - this.stand.y) / STAND_RADIUS_Y

    return dx * dx + dy * dy <= 1
  }

  /**
   * 앞에 서서 상호작용했을 때 할 일. 물건마다 여기를 채웁니다. 기본은 아무것도 안 함.
   *
   * 두 가지를 조심하십시오.
   * `Character.onArrive` 가 `arrivalTask` 보다 **먼저** 이걸 부릅니다 — 그래서
   * `Session.chooseOption` 으로 책상까지 걸어가면, 판정에 앞서 `WorkDesk` 의
   * 이슈 목록이 먼저 열립니다.
   * 그리고 길이 막혀 못 가면 `approach` 가 들려 보낸 일만 하고 이건 건너뜁니다 —
   * 이미 그 앞에 서 있을 때가 여기에 해당합니다.
   */
  onInteract(): void {}
}

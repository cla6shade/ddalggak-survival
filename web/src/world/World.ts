import { Wall } from './scene/Wall'
import { Floor } from './scene/Floor'
import { Character } from './scene/Character'
import { WorldObject } from './base/WorldObject'
import { Door } from './objects/Door'
// import { Bookshelf } from './objects/Bookshelf'
import { Refrigerator } from './objects/Refrigerator'
import { WorkDesk } from './objects/WorkDesk'
import { Bed } from './objects/Bed'
import type { Collidable } from './base/Collidable'
import type { Drawable } from '@/core/Drawable'
import type { Updatable } from '@/core/Updatable'
import type { Point } from './geometry/Point'
import type { Rect } from './geometry/Rect'

/**
 * 방 크기는 화면과 무관하게 고정입니다. 화면에 맞춰 늘이지 않고 정수 배율로만
 * 확대하므로, 폰이든 데스크톱이든 픽셀 한 칸 크기와 구도가 같습니다.
 */
export const ROOM_WIDTH = 180
export const ROOM_HEIGHT = 168

/** 걸어다닐 수 있는 영역. 이 위(y < top)는 벽입니다. */
export const FLOOR_RECT: Rect = { left: 14, right: 166, top: 64, bottom: 162 }

/** 방 밖으로 벽과 바닥을 흘려 보내는 거리. 어느 화면 비율에서도 빈 자리가 없게. */
export const BLEED = 600

/** 캐릭터의 시작 좌표. */
export const ENTRY: Point = { x: 96, y: 156 }

/** 자리도 차지하고 그려지기도 하는 것. 정렬은 `y`, 출력은 `draw` 로 합니다. */
type Piece = Collidable & Drawable

/**
 * 게임이 벌어지는 방 하나. 벽·바닥·물건·플레이어를 스스로 갖춥니다.
 * 방이 하나뿐이라 배치를 밖으로 올리지 않습니다.
 *
 * 앞뒤 순서는 발밑 `y` 로만 정합니다 — 위쪽(작은 y)에 선 것이 먼저 그려져
 * 아래쪽에 선 것에 가려집니다.
 */
export class World implements Drawable, Updatable {
  readonly width = ROOM_WIDTH
  readonly height = ROOM_HEIGHT

  readonly wall = new Wall()
  readonly floor = new Floor()

  readonly player: Character

  /** 이슈를 처리하는 자리. 선택지를 누르면 여기까지 걸어간 뒤에 판정합니다. */
  readonly workDesk = new WorkDesk()

  /** 방에 놓인 것들. 캐릭터와 물건이 같은 목록에 섞여 들어갑니다. */
  readonly pieces: Piece[] = []

  constructor() {
    this.player = new Character(this, ENTRY.x, ENTRY.y)
    this.add(this.player)

    for (const object of [
      new Door(),
      // new Bookshelf(),
      new Refrigerator(),
      this.workDesk,
      new Bed(),
    ]) {
      this.add(object)
    }
  }

  add(piece: Piece): void {
    if (!this.pieces.includes(piece)) this.pieces.push(piece)
  }

  remove(piece: Piece): void {
    const index = this.pieces.indexOf(piece)
    if (index !== -1) this.pieces.splice(index, 1)
  }

  /** 그 지점에서 가장 앞에 있는 물건. 그림과 도착 표시 둘 다 눌리는 자리입니다. */
  findObjectAt(x: number, y: number): WorldObject | null {
    const hits = this.pieces.filter(
      (piece): piece is WorldObject =>
        piece instanceof WorldObject &&
        (piece.containsPoint(x, y) || piece.containsStand(x, y)),
    )

    // 발밑이 아래일수록 앞에 있으니, 가장 앞엣것을 고릅니다.
    return hits.sort((a, b) => b.y - a.y)[0] ?? null
  }

  /** 화면을 눌렀을 때. 물건을 눌렀으면 그 앞으로 걸어가게 합니다. */
  handleClick(x: number, y: number): void {
    const object = this.findObjectAt(x, y)
    if (object) this.player.approach(object)
  }

  update(delta: number): void {
    this.player.update(delta)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.wall.draw(ctx)
    this.floor.draw(ctx)

    // 도착 표시는 물건보다 뒤에 깔립니다.
    for (const piece of this.pieces) {
      if (piece instanceof WorldObject) piece.drawStand(ctx)
    }

    for (const piece of [...this.pieces].sort((a, b) => a.y - b.y)) {
      piece.draw(ctx)
    }
  }
}

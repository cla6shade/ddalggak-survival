import { BLEED, FLOOR_RECT, ROOM_HEIGHT, ROOM_WIDTH } from '../World'
import { session } from '@/core/Session'
import type { Collidable } from '../base/Collidable'
import type { Drawable } from '@/core/Drawable'
import type { TileTexture } from '@/generated/atlas'

/**
 * 걸어다닐 수 있는 바닥. 막아 세우는 게 아니라 걸을 수 있는 범위를 정하는 쪽이라
 * `Collidable` 이 아닙니다. 네 변이 곧 길찾기 격자의 경계입니다.
 *
 * 그리는 범위는 화면 끝까지 빈 자리가 없도록 밖으로 넉넉히 흘려보냅니다.
 */
export class Floor implements Drawable {
  tile: TileTexture = 'wood_floor'

  left = FLOOR_RECT.left
  right = FLOOR_RECT.right
  top = FLOOR_RECT.top
  bottom = FLOOR_RECT.bottom

  private pattern: CanvasPattern | null = null

  get width(): number {
    return this.right - this.left
  }

  get height(): number {
    return this.bottom - this.top
  }

  /** 발밑이 바닥 안에 있는지. 충돌 상자의 좌우 끝까지 함께 봅니다. */
  contains(body: Collidable): boolean {
    return (
      body.left >= this.left &&
      body.right <= this.right &&
      body.y >= this.top &&
      body.y <= this.bottom
    )
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // 타일 이미지가 아직 없으면 다음 프레임에 다시 시도합니다.
    const image = session.assets.getTileImage(this.tile)
    if (!image) return
    this.pattern ??= ctx.createPattern(image, 'repeat')
    if (!this.pattern) return

    ctx.save()
    ctx.fillStyle = this.pattern
    // 변환을 건드리지 않아 타일 격자가 방 좌표 (0, 0) 에서 시작합니다.
    ctx.fillRect(
      -BLEED,
      FLOOR_RECT.top,
      ROOM_WIDTH + BLEED * 2,
      ROOM_HEIGHT - FLOOR_RECT.top + BLEED,
    )
    ctx.restore()
  }
}

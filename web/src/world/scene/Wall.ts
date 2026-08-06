import { Collidable } from '../base/Collidable'
import { BLEED, FLOOR_RECT, ROOM_WIDTH } from '../World'
import { session } from '@/core/Session'
import type { Drawable } from '@/core/Drawable'
import type { TileTexture } from '@/generated/atlas'

/**
 * 방의 뒷벽. 바닥선보다 위쪽입니다. 충돌 상자는 방 안쪽만 재지만, 그리는 건
 * 화면 끝까지 빈 자리가 없도록 좌우와 위로 넉넉히 흘려보냅니다.
 */
export class Wall extends Collidable implements Drawable {
  tile: TileTexture = 'concrete_bare'

  private pattern: CanvasPattern | null = null

  constructor() {
    // 발밑 기준이라 아래끝이 바닥선입니다.
    super(ROOM_WIDTH / 2, FLOOR_RECT.top, ROOM_WIDTH, FLOOR_RECT.top)
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
    ctx.fillRect(-BLEED, -BLEED, ROOM_WIDTH + BLEED * 2, FLOOR_RECT.top + BLEED)
    ctx.restore()
  }
}

/**
 * 방 안에서 자리를 차지하는 것. 보이는지 여부는 관심사가 아닙니다 —
 * 눈에 안 보이는 벽 판정이나 트리거도 이것만 상속합니다.
 *
 * 좌표 `(x, y)` 는 언제나 **발밑** 입니다 — 가로는 한가운데, 세로는 바닥에 닿는 지점.
 * 스프라이트 키가 달라도 서 있는 자리가 흔들리지 않고, 앞뒤 순서도 `y` 하나로 정해집니다.
 * 충돌 상자는 그 발밑을 기준으로 위로 `height`, 좌우로 `width / 2` 만큼 뻗습니다.
 */
export abstract class Collidable {
  x: number
  y: number
  width: number
  height: number

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  get left(): number {
    return this.x - this.width / 2
  }

  get right(): number {
    return this.x + this.width / 2
  }

  get top(): number {
    return this.y - this.height
  }

  get bottom(): number {
    return this.y
  }

  /** 두 충돌 상자가 겹치는지. 변이 맞닿기만 한 것은 겹친 것으로 보지 않습니다. */
  intersects(other: Collidable): boolean {
    return (
      this.left < other.right &&
      this.right > other.left &&
      this.top < other.bottom &&
      this.bottom > other.top
    )
  }

  /** 그 점이 충돌 상자 안에 있는지. 탭 판정에 씁니다. */
  containsPoint(x: number, y: number): boolean {
    return x >= this.left && x <= this.right && y >= this.top && y <= this.bottom
  }

  /** 발밑끼리의 거리. 가까운 것부터 고를 때 씁니다. */
  distanceTo(other: Collidable): number {
    return Math.hypot(other.x - this.x, other.y - this.y)
  }
}

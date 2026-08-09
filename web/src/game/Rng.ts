/**
 * 시드로 재현 가능한 난수.
 *
 * `simulator/` 가 이 파일을 그대로 불러 씁니다. 사본은 없고, 만들어도 안 됩니다 —
 * 수열이 갈리는 순간 시뮬레이터가 다른 게임을 재는 셈이 됩니다.
 */
export class Rng {
  private state_: number

  constructor(seed: number) {
    // 0 시드는 계속 0 을 뱉으므로 피합니다.
    this.state_ = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0
  }

  /**
   * 지금까지 굴린 만큼 나아간 내부 상태. 세이브가 이걸 함께 실어야
   * 이어서 시작한 판이 같은 수열을 계속 씁니다.
   */
  get state(): number {
    return this.state_
  }

  restore(state: number): void {
    this.state_ = state | 0
  }

  /** [0, 1) */
  next(): number {
    // mulberry32
    this.state_ = (this.state_ + 0x6d2b79f5) | 0
    let t = this.state_
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** [0, max) 정수 */
  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }

  rollChance(probability: number): boolean {
    return this.next() < probability
  }

  pickOne<T>(items: readonly T[]): T {
    const item = items[this.nextInt(items.length)]
    if (item === undefined) throw new Error('빈 배열에서 뽑을 수 없습니다')
    return item
  }
}

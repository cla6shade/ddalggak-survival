/**
 * 시드로 재현 가능한 난수. `simulator/src/rng.ts` 사본이라 같은 시드에서 같은 수열이
 * 나와야 합니다 — 알고리즘을 바꾸면 양쪽을 함께 고쳐야 합니다.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    // 0 시드는 계속 0 을 뱉으므로 피합니다.
    this.state = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0
  }

  /** [0, 1) */
  next(): number {
    // mulberry32
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** [0, max) 정수 */
  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }

  /** 지수분포. 포아송 과정에서 다음 사건까지의 대기 시간입니다. */
  nextWaitingTime(rate: number): number {
    if (rate <= 0) return Number.POSITIVE_INFINITY
    return -Math.log(1 - this.next()) / rate
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

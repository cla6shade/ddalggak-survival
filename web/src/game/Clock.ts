/** 한 시간의 길이(분). 방치 사고처럼 시간 단위로 재는 확률이 이 단위를 씁니다. */
export const MINUTES_PER_HOUR = 60

/** 하루의 길이(분). 날을 넘겨 재는 값은 전부 이 단위를 씁니다. */
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR

/** 현실 1초에 게임 몇 분이 흐르는지. */
const MINUTES_PER_SECOND = 1

/** 지금 며칠 몇 시인지. */
export class Clock {
  day = 1
  /** 자정부터의 분. 프레임 사이의 조각까지 들고 있어서 정수가 아닙니다. */
  minutes = 0

  /**
   * 판이 시작한 뒤로 흐른 총 분.
   * 다음 이슈가 터질 시각처럼 날을 넘겨 재는 값은 이걸로 비교합니다 —
   * `minutes` 는 자정마다 0 으로 돌아가서 못 씁니다.
   */
  get totalMinutes(): number {
    return (this.day - 1) * MINUTES_PER_DAY + this.minutes
  }

  /** 흐른 **현실 초** 만큼 시계를 돌립니다. 보이는 분이 바뀌었으면 `true`. */
  advanceSeconds(seconds: number): boolean {
    return this.advanceMinutes(seconds * MINUTES_PER_SECOND)
  }

  /**
   * **게임 분** 만큼 시계를 밉니다.
   * `advanceSeconds` 와 나눠 둔 이유는 단위 때문입니다 — 지금은 두 값이 같지만
   * `MINUTES_PER_SECOND` 가 1 이 아니게 되는 순간 섞어 쓴 자리가 조용히 틀어집니다.
   */
  advanceMinutes(minutes: number): boolean {
    const before = Math.floor(this.minutes)

    this.minutes += minutes
    while (this.minutes >= MINUTES_PER_DAY) {
      this.minutes -= MINUTES_PER_DAY
      this.day += 1
    }

    return Math.floor(this.minutes) !== before
  }
}

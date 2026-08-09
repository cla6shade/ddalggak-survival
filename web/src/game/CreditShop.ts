import type { Session } from '@/core/Session'

/**
 * 파는 묶음 하나. 개수와 값을 들고, 살 수 있는지와 사는 것까지 스스로 합니다.
 */
export class CreditBundle {
  constructor(
    private readonly session: Session,
    readonly amount: number,
    readonly cost: number,
  ) {}

  /** 지금 이 묶음을 살 돈이 있는지. */
  canAfford(): boolean {
    return this.session.player.money >= this.cost
  }

  /**
   * 이 묶음을 삽니다. 돈이 모자라면 아무것도 하지 않고 `false` 입니다.
   *
   * `player` 만 제자리에서 고칩니다 — 계기판을 다시 그리고 세이브를 쓰는 것은
   * 부른 쪽이 합니다(`Issue.resolve` · `RoomAction.perform` 과 같은 규칙).
   */
  buy(): boolean {
    if (!this.canAfford()) return false

    const { player } = this.session
    player.money -= this.cost
    player.credit += this.amount

    return true
  }
}

/**
 * 크레딧을 돈으로 사는 유일한 통로. 계기판의 크레딧 타일이 이 목록을 폅니다.
 *
 * 낱개로는 못 삽니다 — 정해진 묶음 중 하나입니다. 딸깍 한 번이 15개라 가장 작은
 * 묶음으로는 한 번을 채우지 못합니다. 「사고 나서 얼마 남는지」가 매번 어긋나야
 * 크레딧이 세는 자원으로 읽힙니다.
 *
 * 큰 묶음이라고 싸지지 않습니다 — 개당 값은 하나입니다.
 */
export class CreditShop {
  /** 크레딧 한 개 값(원). */
  static readonly PRICE = 1_000
  /** 파는 묶음의 개수들. 작은 것부터 적습니다 — 목록에 뜨는 순서가 곧 이 순서입니다. */
  static readonly SIZES: readonly number[] = [10, 50, 100]

  readonly bundles: readonly CreditBundle[]

  constructor(session: Session) {
    this.bundles = CreditShop.SIZES.map(
      (amount) => new CreditBundle(session, amount, amount * CreditShop.PRICE),
    )
  }
}

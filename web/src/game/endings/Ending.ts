import type { Clock } from '../Clock'
import type { IssueManager } from '../IssueManager'
import type { ProductStatus } from '../stats/ProductStatus'
import type { PlayerStatus } from '../stats/PlayerStatus'

export type EndingId =
  | 'bankrupt'
  | 'burnout'
  | 'hacked'
  | 'idea-stolen'
  | 'lawsuit'
  | 'consumer-report'

/** 엔딩 규칙이 읽을 수 있는 한 판의 현재 상태. */
export interface EndingContext {
  readonly player: PlayerStatus
  readonly product: ProductStatus
  readonly clock: Clock
  readonly issues: IssueManager
}

/** 엔딩 순간의 숫자. 이후 원본 상태가 바뀌어도 결과 화면은 이 값만 봅니다. */
export interface EndingSnapshot {
  day: number
  money: number
  stamina: number
  credit: number
  users: number
  quality: number
  revenue: number
  spend: number
  solvedIssues: number
}

export interface EndingResult {
  id: EndingId
  snapshot: EndingSnapshot
}

/**
 * 엔딩 하나의 공통 기반 클래스.
 *
 * 하위 클래스는 자기 조건만 `matches` 로 정의합니다. Session은 구체적인 엔딩을
 * 모르고 EndingManager에 현재 상태를 넘길 뿐입니다.
 */
export abstract class Ending {
  constructor(
    readonly id: EndingId,
    /** 큰 값이 동시에 충족됐을 때 먼저입니다. */
    readonly priority: number,
  ) {}

  abstract matches(context: EndingContext): boolean
}

export function createEndingSnapshot(context: EndingContext): EndingSnapshot {
  return {
    day: context.clock.day,
    money: context.player.money,
    stamina: context.player.stamina,
    credit: context.player.credit,
    users: context.product.users,
    quality: context.product.quality,
    revenue: context.product.revenue,
    spend: context.product.spend,
    solvedIssues: context.issues.solvedCount,
  }
}

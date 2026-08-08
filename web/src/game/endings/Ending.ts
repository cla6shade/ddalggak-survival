import type { Session } from '@/core/Session'
import type { AtlasFrame } from '@/generated/atlas'

export type EndingId =
  | 'bankrupt'
  | 'burnout'
  | 'hacked'
  | 'idea-stolen'
  | 'lawsuit'
  | 'consumer-report'
  | 'data-loss'
  | 'data-leak'
  | 'race-condition'
  | 'search-ban'
  | 'reputation'

/**
 * 엔딩 화면에 그대로 실리는 그림과 문구. 엔딩이 자기 것으로 들고 있습니다 —
 * 화면이 ID 로 표를 뒤져 문구를 찾아오면, 엔딩 하나를 더할 때 고칠 자리가 흩어집니다.
 */
export class EndingPresentation {
  constructor(
    readonly eyebrow: string,
    readonly title: string,
    readonly description: string,
    /** 아틀라스에 그림이 아직 없는 엔딩은 비웁니다 — 화면이 자리 표시로 대신 그립니다. */
    readonly frame?: AtlasFrame,
  ) {}
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
  ending: Ending
  snapshot: EndingSnapshot
}

/**
 * 엔딩 하나. 자기 id·우선순위·문구·조건을 전부 스스로 듭니다.
 *
 * 세상은 생성자로 받은 `session` 을 통해 읽습니다 — `Issue` 와 같은 규칙이라,
 * 타입만 `import type` 으로 가져와 순환 참조가 생기지 않습니다.
 */
export abstract class Ending {
  constructor(
    protected readonly session: Session,
    readonly id: EndingId,
    /** 큰 값이 동시에 충족됐을 때 먼저입니다. 사건 엔딩은 겨루지 않으므로 0. */
    readonly priority: number,
    readonly presentation: EndingPresentation,
  ) {}

  /**
   * 상태만 보고 스스로 성립하는 엔딩이 덮어씁니다
   */
  matches(): boolean {
    return false
  }
}

export function createEndingSnapshot(session: Session): EndingSnapshot {
  const { player, product, clock, issues } = session

  return {
    day: clock.day,
    money: player.money,
    stamina: player.stamina,
    credit: player.credit,
    users: product.users,
    quality: product.quality,
    revenue: product.revenue,
    spend: product.spend,
    solvedIssues: issues.solvedCount,
  }
}

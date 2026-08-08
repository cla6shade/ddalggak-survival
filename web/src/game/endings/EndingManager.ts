import { createEndingSnapshot } from './Ending'
import { createEndings } from './EndingCatalog'
import type { Ending, EndingId, EndingResult } from './Ending'
import type { Session } from '@/core/Session'

/** 한 판의 엔딩을 우선순위대로 판정하고, 첫 결과를 영구히 잠급니다. */
export class EndingManager {
  /** 우선순위 내림차순. 동시에 충족되면 큰 값이 이깁니다. */
  private readonly all: readonly Ending[]
  private result: EndingResult | null = null

  constructor(private readonly session: Session) {
    this.all = createEndings(session).sort((a, b) => b.priority - a.priority)
  }

  get current(): EndingResult | null {
    return this.result
  }

  /** 선택 결과나 시간 경과로 즉시 발생한 사건 엔딩을 확정합니다. */
  trigger(id: EndingId): EndingResult {
    const ending = this.all.find((candidate) => candidate.id === id)
    // 유니온에는 있는데 카탈로그에 없는 엔딩이 조용히 넘어가면, 판이 끝나지 않고 이어집니다.
    if (!ending) throw new Error(`엔딩 '${id}' 이 카탈로그에 없습니다`)

    this.result ??= { ending, snapshot: createEndingSnapshot(this.session) }

    return this.result
  }

  /** 지금 조건을 만족한 엔딩. 사건 엔딩은 `matches` 를 덮어쓰지 않아 걸리지 않습니다. */
  evaluate(): EndingResult | null {
    if (this.result) return this.result

    const matched = this.all.find((ending) => ending.matches())
    if (!matched) return null

    return this.trigger(matched.id)
  }
}

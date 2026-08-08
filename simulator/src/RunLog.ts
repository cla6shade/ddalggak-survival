import { MINUTES_PER_DAY } from '@/game/Clock'
import type { EndingId, EndingSnapshot } from '@/game/endings/Ending'
import type { OptionKind } from '@/game/issues/IssueOption'
import type { DomainCode } from '@/game/issues/Issue'

/** 뷰어와 시뮬레이터가 맞춰 보는 계약. 모양을 바꾸면 번호를 올립니다. */
export const RUN_LOG_SCHEMA = 'ddalggak-survival/run-log@1'

/**
 * 한 판을 어떻게 돌릴지.
 *
 * 이 값들이 결과를 바꿉니다 — 시드가 같아도 틱 길이가 다르면 난수를 굴리는 횟수가
 * 달라져 다른 판이 됩니다. 그래서 `hash` 를 기록에 함께 실어, 골든 테스트가
 * 「설정이 바뀌었다」와 「결과가 바뀌었다」를 구별할 수 있게 합니다.
 */
export class SimConfig {
  /** 결정 하나당 흘려보낼 게임 분. 웹에서 걷고 고민하는 사이에 흐르는 시간입니다. */
  readonly tickMinutes: number
  /** 이 날을 넘기면 「생존」으로 끊습니다. 이 게임에는 이기는 엔딩이 없습니다. */
  readonly maxDays: number
  /** 곡선용 표본을 남길 간격(게임 분). 사건이 난 시각에는 간격과 무관하게 남깁니다. */
  readonly sampleEveryMinutes: number

  constructor(overrides: Partial<SimConfigValues> = {}) {
    this.tickMinutes = overrides.tickMinutes ?? 1
    this.maxDays = overrides.maxDays ?? 60
    this.sampleEveryMinutes = overrides.sampleEveryMinutes ?? 15
  }

  /**
   * 절대 넘지 않을 반복 횟수. 매 스텝이 최소 `tickMinutes` 만큼은 시계를 밀므로
   * 이 값에 닿는 일은 없어야 합니다 — 닿았다면 그 자체가 버그 신호입니다.
   */
  get maxSteps(): number {
    return Math.ceil((this.maxDays * MINUTES_PER_DAY) / this.tickMinutes) + 1_000
  }

  /** 결과를 바꾸는 값들의 지문. FNV-1a 32비트. */
  get hash(): string {
    const text = JSON.stringify(this.toJSON())
    let hash = 0x811c9dc5

    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }

    return (hash >>> 0).toString(16).padStart(8, '0')
  }

  toJSON(): SimConfigValues {
    return {
      tickMinutes: this.tickMinutes,
      maxDays: this.maxDays,
      sampleEveryMinutes: this.sampleEveryMinutes,
    }
  }
}

export interface SimConfigValues {
  tickMinutes: number
  maxDays: number
  sampleEveryMinutes: number
}

export interface RunLogMeta {
  seed: number
  policySeed: number
  policy: { name: string; params: Record<string, number> }
  config: SimConfigValues
  configHash: string
}

/** 판이 왜 끝났는지. `survived` 는 `maxDays` 에 닿은 것이지 이긴 것이 아닙니다. */
export type RunOutcomeReason = 'ending' | 'survived' | 'aborted'

export interface RunOutcome {
  reason: RunOutcomeReason
  endingId: EndingId | null
  eyebrow: string | null
  title: string | null
  /** 판이 끝난 시각(판 시작 후 총 분). */
  endedAtMinutes: number
  days: number
  snapshot: EndingSnapshot
}

/** 곡선용 표본. 값마다 배열 하나 — 뷰어가 그대로 선으로 잇습니다. */
export interface RunSamples {
  t: number[]
  money: number[]
  stamina: number[]
  credit: number[]
  users: number[]
  quality: number[]
  userGrowthPerHour: number[]
  revenuePerHour: number[]
  serverCostPerHour: number[]
  openIssues: number[]
}

interface RunEventBase {
  /** 판 시작 후 총 분. */
  t: number
  day: number
}

export interface IssueSpawnedEvent extends RunEventBase {
  type: 'issue-spawned'
  issueCode: string
  title: string
  domain: DomainCode
  neglectText: string
}

export interface ChoiceEvent extends RunEventBase {
  type: 'choice'
  issueCode: string
  issueTitle: string
  optionTitle: string
  optionKind: OptionKind
  successRate: number
  solved: boolean
  blocked: boolean
  qualityGain: number
  minutes: number
}

export interface ActionEvent extends RunEventBase {
  type: 'action'
  actionId: string
  title: string
  badge: string
  minutes: number
  staminaGain: number
  moneyGain: number
  blocked: boolean
}

export interface WaitEvent extends RunEventBase {
  type: 'wait'
  /** 이어진 기다림을 한 줄로 묶은 총 시간. */
  minutes: number
}

export interface DayRolledEvent extends RunEventBase {
  type: 'day-rolled'
}

export interface EndingEvent extends RunEventBase {
  type: 'ending'
  endingId: EndingId
  eyebrow: string
  title: string
  description: string
}

export type RunEvent =
  | IssueSpawnedEvent
  | ChoiceEvent
  | ActionEvent
  | WaitEvent
  | DayRolledEvent
  | EndingEvent

export interface RunStats {
  steps: number
  decisionsByKind: Record<string, number>
  optionsByKind: Record<string, number>
  actionCounts: Record<string, number>
  issuesSpawned: number
  issuesSolved: number
  choicesFailed: number
  blockedAttempts: number
  /** 난수가 어디까지 갔는지. 결정론 회귀 테스트가 이 값을 봅니다. */
  finalRngState: number
}

export interface RunLog {
  schema: typeof RUN_LOG_SCHEMA
  meta: RunLogMeta
  outcome: RunOutcome
  samples: RunSamples
  events: RunEvent[]
  stats: RunStats
}

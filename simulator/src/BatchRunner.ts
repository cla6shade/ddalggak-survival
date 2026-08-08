import { Rng } from '@/game/Rng'
import { Playthrough } from './Playthrough'
import { SimConfig } from './RunLog'
import type { RunOutcomeReason } from './RunLog'

/** 판 하나를 한 줄로 줄인 것. 표와 분포는 전부 이 줄들에서 나옵니다. */
export interface BatchRow {
  policy: string
  seed: number
  reason: RunOutcomeReason
  /** 엔딩으로 끝났으면 그 id, 아니면 `reason` 을 그대로 씁니다. */
  result: string
  days: number
  steps: number
  money: number
  users: number
  quality: number
  solvedIssues: number
}

export interface BatchSummary {
  policy: string
  runs: number
  /** 결과별 판 수. 키는 엔딩 id 이거나 `survived` / `aborted` 입니다. */
  results: Record<string, number>
  days: Distribution
  solvedIssues: Distribution
  users: Distribution
  quality: Distribution
}

export interface BatchReport {
  baseSeed: number
  runs: number
  config: ReturnType<SimConfig['toJSON']>
  configHash: string
  summaries: BatchSummary[]
  /**
   * 판마다 한 줄. 판이 많으면 비어 있습니다 — 100만 판이면 이 배열 하나가
   * 100MB 를 넘어 쓸모보다 짐이 큽니다. `rowsOmitted` 로 몇 줄을 버렸는지 남깁니다.
   */
  rows: BatchRow[]
  rowsOmitted: number
}

/**
 * 정책 하나의 집계.
 *
 * 판마다 만든 줄을 통째로 쌓지 않고 **필요한 숫자만 뽑아 담습니다.** 분위값을
 * 내려면 값이 전부 있어야 하지만, 객체가 아니라 숫자 배열이면 100만 판도 수십 MB 로 끝납니다.
 */
class PolicyTally {
  readonly results: Record<string, number> = {}
  private readonly days: number[] = []
  private readonly solvedIssues: number[] = []
  private readonly users: number[] = []
  private readonly quality: number[] = []
  private count = 0

  add(row: BatchRow): void {
    this.count += 1
    this.results[row.result] = (this.results[row.result] ?? 0) + 1
    this.days.push(row.days)
    this.solvedIssues.push(row.solvedIssues)
    this.users.push(row.users)
    this.quality.push(row.quality)
  }

  summarize(policy: string): BatchSummary {
    return {
      policy,
      runs: this.count,
      results: this.results,
      days: Distribution.of(this.days),
      solvedIssues: Distribution.of(this.solvedIssues),
      users: Distribution.of(this.users),
      quality: Distribution.of(this.quality),
    }
  }
}

/**
 * 여러 판을 돌려 분포를 냅니다.
 *
 * 정책이 여럿이면 **같은 게임 시드 목록을 모두에게 똑같이** 물립니다. 그래야
 * 「정책이 나아서 오래 버텼다」와 「운 좋은 시드를 받았다」가 섞이지 않습니다.
 * 정책이 쓰는 난수는 게임 난수와 갈라 둔 별도 수열이라 서로를 밀지 않습니다.
 */
export class BatchRunner {
  /** 이 줄 수까지만 판별 기록을 그대로 싣습니다. 넘으면 집계만 남깁니다. */
  static readonly ROW_LIMIT = 50_000

  private readonly baseSeed: number
  private readonly runs: number
  private readonly policyNames: readonly string[]
  private readonly config: SimConfig

  constructor(options: {
    baseSeed?: number
    runs: number
    policies: readonly string[]
    config?: SimConfig
  }) {
    this.baseSeed = options.baseSeed ?? 1
    this.runs = options.runs
    this.policyNames = options.policies
    this.config = options.config ?? new SimConfig()
  }

  run(onProgress?: (done: number, total: number) => void): BatchReport {
    const total = this.runs * this.policyNames.length
    const keepRows = total <= BatchRunner.ROW_LIMIT
    const rows: BatchRow[] = []
    const tallies = new Map<string, PolicyTally>()
    let done = 0

    for (const policy of this.policyNames) {
      const tally = new PolicyTally()
      tallies.set(policy, tally)

      // 시드는 정책마다 같은 수열을 다시 뽑습니다. 100만 개 배열을 들고 있지
      // 않으려는 것이고, 어차피 `baseSeed` 가 같으면 같은 목록이 나옵니다.
      const rng = new Rng(this.baseSeed)
      for (let i = 0; i < this.runs; i += 1) {
        const row = this.runOne(policy, rng.nextInt(2 ** 31))
        tally.add(row)
        if (keepRows) rows.push(row)

        done += 1
        onProgress?.(done, total)
      }
    }

    return {
      baseSeed: this.baseSeed,
      runs: this.runs,
      config: this.config.toJSON(),
      configHash: this.config.hash,
      summaries: this.policyNames.map(
        (policy) => tallies.get(policy)?.summarize(policy) ?? new PolicyTally().summarize(policy),
      ),
      rows,
      rowsOmitted: keepRows ? 0 : total,
    }
  }

  private runOne(policyName: string, seed: number): BatchRow {
    const { outcome, stats } = Playthrough.play(seed, policyName, this.config)

    return {
      policy: policyName,
      seed,
      reason: outcome.reason,
      result: outcome.endingId ?? outcome.reason,
      days: outcome.snapshot.day,
      steps: stats.steps,
      money: outcome.snapshot.money,
      users: outcome.snapshot.users,
      quality: outcome.snapshot.quality,
      solvedIssues: outcome.snapshot.solvedIssues,
    }
  }

}

/** 숫자 묶음 하나의 생김새. 평균만으로는 꼬리가 안 보여서 사분위까지 같이 냅니다. */
export class Distribution {
  private constructor(
    readonly count: number,
    readonly mean: number,
    readonly min: number,
    readonly p25: number,
    readonly median: number,
    readonly p75: number,
    readonly max: number,
  ) {}

  static of(values: readonly number[]): Distribution {
    if (values.length === 0) return new Distribution(0, 0, 0, 0, 0, 0, 0)

    const sorted = [...values].sort((a, b) => a - b)
    const sum = sorted.reduce((total, value) => total + value, 0)

    return new Distribution(
      sorted.length,
      round(sum / sorted.length),
      round(quantile(sorted, 0)),
      round(quantile(sorted, 0.25)),
      round(quantile(sorted, 0.5)),
      round(quantile(sorted, 0.75)),
      round(quantile(sorted, 1)),
    )
  }
}

/** 정렬된 배열에서 분위값 하나. 사이에 걸리면 가까운 쪽 두 개를 섞습니다. */
function quantile(sorted: readonly number[], ratio: number): number {
  const position = (sorted.length - 1) * ratio
  const low = Math.floor(position)
  const high = Math.ceil(position)
  const lowValue = sorted[low] ?? 0
  const highValue = sorted[high] ?? lowValue

  return lowValue + (highValue - lowValue) * (position - low)
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

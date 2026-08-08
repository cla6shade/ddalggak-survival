import { Session } from '@/core/Session'
import { Rng } from '@/game/Rng'
import { createEndingSnapshot } from '@/game/endings/Ending'
import { PlayerView } from './PlayerView'
import { PolicyRegistry } from './policies/PolicyRegistry'
import { RUN_LOG_SCHEMA, SimConfig } from './RunLog'
import type { Policy } from './Policy'
import type { Decision, MenuKey } from './PlayerView'
import type { RunEvent, RunLog, RunOutcome, RunSamples, RunStats } from './RunLog'
import type { Issue } from '@/game/issues/Issue'
import type { RoomAction } from '@/game/actions/RoomAction'

/**
 * `t` 와 `day` 는 `push` 가 채웁니다 — 부르는 쪽이 매번 적으면 어긋나기 쉽습니다.
 *
 * `Omit` 은 유니온에 그냥 씌우면 공통 키만 남기고 갈래를 뭉갭니다.
 * `T extends unknown` 을 한 번 거쳐 갈래마다 따로 씌웁니다.
 */
type PartialEvent<T = Exclude<RunEvent, { type: 'wait' }>> = T extends unknown
  ? Omit<T, 't' | 'day'>
  : never

export interface PlaythroughOptions {
  seed: number
  /** 정책이 쓰는 난수의 시드. 기록에만 실립니다 — `policy` 가 이미 들고 있습니다. */
  policySeed: number
  policy: Policy
  config?: SimConfig
}

/**
 * 한 판. 브라우저 대신 여기서 게임을 굴리고, 오간 것을 전부 적어 둡니다.
 *
 * 스텝 하나의 순서는 웹과 같습니다 — **시간이 먼저 흐르고, 그 화면을 보고 고르고,
 * 고른 것을 실행합니다.** 웹에서는 캐릭터가 걷고 사람이 고민하는 동안 매 프레임
 * 시계가 도는데, 그 몫을 스텝마다 틱 한 번으로 갈음합니다.
 *
 * 무슨 일이 있었는지는 **호출 전후의 상태를 비교해** 알아냅니다. 게임 쪽에 기록용
 * 배선을 새로 달지 않기 위해서입니다 — 웹이 안 쓰는 코드가 게임에 남으면 그게 곧 빚입니다.
 */
export class Playthrough {
  private readonly session: Session
  private readonly policy: Policy
  private readonly config: SimConfig
  private readonly seed: number
  private readonly policySeed: number

  private readonly events: RunEvent[] = []
  private readonly samples: RunSamples = {
    t: [],
    money: [],
    stamina: [],
    credit: [],
    users: [],
    quality: [],
    userGrowthPerHour: [],
    revenuePerHour: [],
    serverCostPerHour: [],
    openIssues: [],
  }

  /** 마지막으로 표본을 남긴 시각. 첫 표본은 무조건 남기므로 음의 무한대에서 시작합니다. */
  private lastSampleAt = Number.NEGATIVE_INFINITY
  /** 직전에 본 열린 이슈들. 이 집합의 변화가 곧 「터졌다 / 닫혔다」입니다. */
  private openIssues = new Set<string>()
  private lastDay = 1

  /** 이어진 기다림. 사건이 하나 나면 그때까지의 몫을 한 줄로 묶어 내보냅니다. */
  private waitingMinutes = 0

  private steps = 0
  private readonly decisionsByKind: Record<string, number> = { issue: 0, action: 0, wait: 0 }
  private readonly optionsByKind: Record<string, number> = { direct: 0, ddalggak: 0, gamble: 0 }
  private readonly actionCounts: Record<string, number> = {}
  private issuesSpawned = 0
  private issuesSolved = 0
  private choicesFailed = 0
  private blockedAttempts = 0

  constructor(options: PlaythroughOptions) {
    this.seed = options.seed
    this.policySeed = options.policySeed
    this.policy = options.policy
    this.config = options.config ?? new SimConfig()
    this.session = new Session(options.seed)
  }

  /**
   * 정책 이름만 알면 한 판을 돌려 줍니다. CLI·배치·테스트가 전부 이 자리를 씁니다 —
   * 정책 난수를 어떻게 가르는지가 여러 곳에 흩어지면 조용히 어긋납니다.
   */
  static play(seed: number, policyName: string, config?: SimConfig): RunLog {
    const policySeed = Playthrough.derivePolicySeed(seed)

    return new Playthrough({
      seed,
      policySeed,
      policy: PolicyRegistry.create(policyName, new Rng(policySeed)),
      config,
    }).run()
  }

  /** 정책 난수는 게임 난수와 다른 자리에서 시작해야 서로를 밀지 않습니다. */
  static derivePolicySeed(seed: number): number {
    return (seed ^ 0x9e3779b9) | 0
  }

  run(): RunLog {
    this.capture(true)
    // 웹의 `Session.start()` 가 세이브 없이 시작할 때 하는 일과 같습니다.
    this.session.issues.spawnInitialIssue()
    this.syncIssues()

    while (this.canContinue()) {
      this.steps += 1

      // 1. 걷고 고민하는 사이에 흐른 시간.
      this.session.tick(this.config.tickMinutes)
      this.settle()
      if (this.session.ended) break

      // 2. 지금 화면을 보고 고릅니다.
      const decision = this.policy.decide(PlayerView.from(this.session))

      // 3. 고른 것을 누릅니다.
      this.execute(decision)
      this.settle()
    }

    this.flushWaiting()
    const outcome = this.finish()
    this.capture(true)

    return {
      schema: RUN_LOG_SCHEMA,
      meta: {
        seed: this.seed,
        policySeed: this.policySeed,
        policy: { name: this.policy.name, params: this.policy.params },
        config: this.config.toJSON(),
        configHash: this.config.hash,
      },
      outcome,
      samples: this.samples,
      events: this.events,
      stats: this.buildStats(),
    }
  }

  private canContinue(): boolean {
    if (this.session.ended) return false
    if (this.session.clock.day > this.config.maxDays) return false

    return this.steps < this.config.maxSteps
  }

  /** 방금 무슨 일이 있었는지 상태를 견주어 알아내고, 표본을 남깁니다. */
  private settle(): void {
    this.syncIssues()

    if (this.session.clock.day !== this.lastDay) {
      this.lastDay = this.session.clock.day
      this.push({ type: 'day-rolled' })
    }

    this.capture(false)
  }

  /** 열린 이슈 집합의 차이가 곧 새로 터진 이슈입니다. 닫힌 쪽은 선택 결과로 이미 적었습니다. */
  private syncIssues(): void {
    const now = this.session.issues.openIssues

    for (const issue of now) {
      if (this.openIssues.has(issue.code)) continue
      this.issuesSpawned += 1
      this.push({
        type: 'issue-spawned',
        issueCode: issue.code,
        title: issue.title,
        domain: issue.domain,
        neglectText: issue.getNeglectText(),
      })
    }

    this.openIssues = new Set(now.map((issue) => issue.code))
  }

  private execute(decision: Decision): void {
    this.decisionsByKind[decision.kind] = (this.decisionsByKind[decision.kind] ?? 0) + 1

    switch (decision.kind) {
      case 'wait':
        this.waitingMinutes += this.config.tickMinutes
        return
      case 'issue':
        this.resolveIssue(decision.issueCode, decision.optionIndex)
        return
      case 'action':
        this.performAction(decision.menu, decision.actionIndex)
        return
    }
  }

  private resolveIssue(code: string, optionIndex: number): void {
    const issue = this.findOpenIssue(code)
    const option = issue?.options[optionIndex]
    // 정책이 없는 자리를 짚었습니다. 판을 세우지 않고 그 스텝을 기다림으로 흘립니다.
    if (!issue || !option) {
      this.waitingMinutes += this.config.tickMinutes

      return
    }

    const successRate = issue.getSuccessRate(option)
    const outcome = this.session.resolveChoice(issue, option)
    if (!outcome) return

    this.optionsByKind[option.kind] = (this.optionsByKind[option.kind] ?? 0) + 1
    if (outcome.blocked) this.blockedAttempts += 1
    if (outcome.solved) this.issuesSolved += 1
    if (!outcome.blocked && !outcome.solved) this.choicesFailed += 1

    this.push({
      type: 'choice',
      issueCode: issue.code,
      issueTitle: issue.title,
      optionTitle: option.title,
      optionKind: option.kind,
      successRate,
      solved: outcome.solved,
      blocked: outcome.blocked,
      qualityGain: outcome.qualityGain,
      minutes: outcome.minutes,
    })
  }

  private performAction(menu: MenuKey, index: number): void {
    const action: RoomAction | undefined = this.session.menus[menu].actions[index]
    if (!action) {
      this.waitingMinutes += this.config.tickMinutes

      return
    }

    const outcome = this.session.performAction(action)
    if (!outcome) return

    this.actionCounts[action.id] = (this.actionCounts[action.id] ?? 0) + 1
    if (outcome.blocked) this.blockedAttempts += 1

    this.push({
      type: 'action',
      actionId: action.id,
      title: action.title,
      badge: action.badge,
      minutes: outcome.minutes,
      staminaGain: outcome.staminaGain,
      moneyGain: outcome.moneyGain,
      blocked: outcome.blocked,
    })
  }

  private findOpenIssue(code: string): Issue | null {
    return this.session.issues.openIssues.find((issue) => issue.code === code) ?? null
  }

  private finish(): RunOutcome {
    const result = this.session.result
    const snapshot = result?.snapshot ?? createEndingSnapshot(this.session)
    const endedAtMinutes = this.session.clock.totalMinutes

    if (result) {
      const { id, presentation } = result.ending
      this.push({
        type: 'ending',
        endingId: id,
        eyebrow: presentation.eyebrow,
        title: presentation.title,
        description: presentation.description,
      })

      return {
        reason: 'ending',
        endingId: id,
        eyebrow: presentation.eyebrow,
        title: presentation.title,
        endedAtMinutes,
        days: snapshot.day,
        snapshot,
      }
    }

    return {
      // 스텝 상한에 닿았다면 살아남은 것이 아니라 시뮬레이터가 멈춘 것입니다.
      reason: this.steps >= this.config.maxSteps ? 'aborted' : 'survived',
      endingId: null,
      eyebrow: null,
      title: null,
      endedAtMinutes,
      days: snapshot.day,
      snapshot,
    }
  }

  private buildStats(): RunStats {
    return {
      steps: this.steps,
      decisionsByKind: this.decisionsByKind,
      optionsByKind: this.optionsByKind,
      actionCounts: this.actionCounts,
      issuesSpawned: this.issuesSpawned,
      issuesSolved: this.issuesSolved,
      choicesFailed: this.choicesFailed,
      blockedAttempts: this.blockedAttempts,
      finalRngState: this.session.rng.state,
    }
  }

  /** 사건 하나를 적습니다. 밀린 기다림이 있으면 그 앞에 한 줄로 묶어 내보냅니다. */
  private push(event: PartialEvent): void {
    this.flushWaiting()
    this.events.push({
      ...event,
      t: round(this.session.clock.totalMinutes),
      day: this.session.clock.day,
    })
    this.capture(true)
  }

  private flushWaiting(): void {
    if (this.waitingMinutes <= 0) return

    const minutes = this.waitingMinutes
    this.waitingMinutes = 0
    this.events.push({
      type: 'wait',
      minutes: round(minutes),
      t: round(this.session.clock.totalMinutes),
      day: this.session.clock.day,
    })
  }

  /** 곡선용 표본 하나. `force` 가 아니면 간격이 찼을 때만 남깁니다. */
  private capture(force: boolean): void {
    const t = this.session.clock.totalMinutes
    if (!force && t - this.lastSampleAt < this.config.sampleEveryMinutes) return
    this.lastSampleAt = t

    const { player, product } = this.session
    this.samples.t.push(round(t))
    this.samples.money.push(round(player.money))
    this.samples.stamina.push(round(player.stamina))
    this.samples.credit.push(round(player.credit))
    this.samples.users.push(round(product.users))
    this.samples.quality.push(round(product.quality))
    this.samples.userGrowthPerHour.push(round(product.userGrowthPerHour))
    this.samples.revenuePerHour.push(round(product.revenuePerHour))
    this.samples.serverCostPerHour.push(round(product.serverCostPerHour))
    this.samples.openIssues.push(this.openIssues.size)
  }
}

/** 기록 파일이 부동소수 꼬리로 부풀지 않게 잘라 둡니다. 소수 넷째 자리면 충분합니다. */
function round(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

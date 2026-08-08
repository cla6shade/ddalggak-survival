import { MINUTES_PER_DAY } from './Clock'
import { createIssues } from './issues/IssueCatalog'
import { createEmptyPressure } from './issues/NeglectEffect'
import type { Issue } from './issues/Issue'
import type { NeglectPressure } from './issues/NeglectEffect'
import type { Session } from '@/core/Session'

/** 하루에 평균 몇 개가 터지는지, 하루마다 얼마씩 늘어나는지, 그리고 그 상한. */
const ISSUES_PER_DAY = 0.35
const ISSUES_PER_DAY_GROWTH = 0.026
const ISSUES_PER_DAY_CAP = 3

/** 세이브에 실리는 이슈 상태. `Set`/`Map` 은 JSON 이 못 실어서 배열로 폅니다. */
export interface IssueManagerState {
  opened: string[]
  solved: [string, number][]
  nextSpawnAt: number
}

/**
 * 이슈들이 지금 어떤 상태인지, 그리고 언제 새로 터지는지.
 *
 * 열려 있는지(`opened`)와 몇 번 해결했는지(`solved`)를 따로 셉니다 — 해결해도
 * 목록에서 사라지지 않고 다시 열릴 수 있기 때문입니다.
 *
 * 발생 시각은 포아송 과정으로 뽑습니다. 다음 한 건의 시각만 들고 있다가
 * 시계가 그 지점을 지날 때 터뜨리고 다시 뽑습니다.
 */
export class IssueManager {
  /** 이 판의 이슈 전부. 세션을 받아야 만들 수 있어 생성자에서 세웁니다. */
  private readonly all: readonly Issue[]
  private readonly opened = new Set<string>()
  private readonly solved = new Map<string, number>()
  /** 다음 이슈가 터지는 시각(판 시작 후 총 분). */
  private nextSpawnAt = Number.POSITIVE_INFINITY

  constructor(private readonly session: Session) {
    this.all = createIssues(session)
  }

  /** 지금 열려 있는 이슈 개수. */
  get count(): number {
    return this.opened.size
  }

  /** 이번 판에서 해결한 누적 건수. 같은 이슈를 여러 번 해결하면 각각 셉니다. */
  get solvedCount(): number {
    let total = 0
    for (const count of this.solved.values()) total += count
    return total
  }

  /** 지금 열려 있는 이슈들. 선택지 UI 가 이걸 읽습니다. */
  get openIssues(): Issue[] {
    return this.all.filter((issue) => this.opened.has(issue.code))
  }

  isOpen(code: string): boolean {
    return this.opened.has(code)
  }

  /** 이 이슈를 지금까지 몇 번 해결했는지. */
  getSolvedCount(code: string): number {
    return this.solved.get(code) ?? 0
  }

  open(code: string): void {
    this.opened.add(code)
  }

  /** 해결했습니다. 닫히고, 해결 횟수가 하나 올라갑니다. */
  solve(code: string): void {
    this.opened.delete(code)
    this.solved.set(code, this.getSolvedCount(code) + 1)
  }

  /** 첫 이슈 후보 중 하나를 균등 확률로 열고, 다음 발생 시각을 잡습니다. */
  spawnInitialIssue(): Issue {
    const issue = this.session.rng.pickOne(this.all.filter((candidate) => candidate.initial))
    this.open(issue.code)
    this.scheduleNext(0)

    return issue
  }

  /**
   * 시계가 `totalMinutes` 까지 왔습니다. 그 사이에 낀 발생 시각마다 이슈를 열고
   * 열린 것들을 돌려줍니다. 틱이 길면 한 번에 여러 개가 나올 수 있습니다.
   */
  spawnDueIssues(totalMinutes: number): Issue[] {
    const spawned: Issue[] = []
    while (totalMinutes >= this.nextSpawnAt) {
      const issue = this.spawnRandomIssue()
      if (issue) spawned.push(issue)
      this.scheduleNext(this.nextSpawnAt)
    }

    return spawned
  }

  /** 닫혀 있는 이슈 중 하나를 균등 확률로 엽니다. 전부 열려 있으면 `null`. */
  spawnRandomIssue(): Issue | null {
    const closed = this.all.filter((issue) => !this.opened.has(issue.code))
    if (closed.length === 0) return null

    const issue = this.session.rng.pickOne(closed)
    this.open(issue.code)

    return issue
  }

  /**
   * 열린 이슈마다 `onNeglect` 를 불러 압력의 합을 만듭니다.
   *
   * 합계를 캐시하지 않는 이유는 `onNeglect` 가 재정의 가능한 메서드이기 때문입니다 —
   * `issue.neglect` 를 직접 더해 캐시하면 재정의한 이슈의 몫이 조용히 빠집니다.
   */
  applyNeglect(minutes: number): NeglectPressure {
    const pressure = createEmptyPressure()
    for (const issue of this.openIssues) issue.onNeglect(minutes, pressure)

    return pressure
  }

  serialize(): IssueManagerState {
    return {
      opened: [...this.opened],
      solved: [...this.solved],
      nextSpawnAt: this.nextSpawnAt,
    }
  }

  restore(state: IssueManagerState): void {
    this.opened.clear()
    for (const code of state.opened) this.opened.add(code)

    this.solved.clear()
    for (const [code, count] of state.solved) this.solved.set(code, count)

    // `JSON.stringify` 는 `Infinity` 를 `null` 로 씁니다. 그대로 되살리면
    // `totalMinutes >= null` 이 늘 참이라 이슈가 끝없이 터집니다.
    this.nextSpawnAt = Number.isFinite(state.nextSpawnAt)
      ? state.nextSpawnAt
      : Number.POSITIVE_INFINITY
  }

  /** 그 날의 발생률로 다음 대기 시간을 뽑습니다. */
  private scheduleNext(from: number): void {
    const perDay = Math.min(
      ISSUES_PER_DAY_CAP,
      ISSUES_PER_DAY + ISSUES_PER_DAY_GROWTH * (this.session.clock.day - 1),
    )
    this.nextSpawnAt = from + this.session.rng.nextWaitingTime(perDay / MINUTES_PER_DAY)
  }
}

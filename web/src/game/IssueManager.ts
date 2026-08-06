import { MINUTES_PER_DAY } from './Clock'
import { INITIAL_ISSUES, ISSUES } from './issues/IssueCatalog'
import { createEmptyPressure } from './issues/NeglectEffect'
import type { Issue, ResolveContext } from './issues/Issue'
import type { NeglectPressure } from './issues/NeglectEffect'
import type { Rng } from './Rng'

/** 하루에 평균 몇 개가 터지는지, 하루마다 얼마씩 늘어나는지, 그리고 그 상한. */
const ISSUES_PER_DAY = 0.35
const ISSUES_PER_DAY_GROWTH = 0.026
const ISSUES_PER_DAY_CAP = 3

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
  private readonly opened = new Set<string>()
  private readonly solved = new Map<string, number>()
  /** 다음 이슈가 터지는 시각(판 시작 후 총 분). */
  private nextSpawnAt = Number.POSITIVE_INFINITY

  /** 지금 열려 있는 이슈 개수. */
  get count(): number {
    return this.opened.size
  }

  /** 지금 열려 있는 이슈들. 선택지 UI 가 이걸 읽습니다. */
  get openIssues(): Issue[] {
    return ISSUES.filter((issue) => this.opened.has(issue.code))
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
  spawnInitialIssue(rng: Rng): Issue {
    const issue = rng.pickOne(INITIAL_ISSUES)
    this.open(issue.code)
    this.scheduleNext(0, 1, rng)

    return issue
  }

  /**
   * 시계가 `totalMinutes` 까지 왔습니다. 그 사이에 낀 발생 시각마다 이슈를 열고
   * 열린 것들을 돌려줍니다. 틱이 길면 한 번에 여러 개가 나올 수 있습니다.
   */
  spawnDueIssues(totalMinutes: number, day: number, rng: Rng): Issue[] {
    const spawned: Issue[] = []
    while (totalMinutes >= this.nextSpawnAt) {
      const issue = this.spawnRandomIssue(rng)
      if (issue) spawned.push(issue)
      this.scheduleNext(this.nextSpawnAt, day, rng)
    }

    return spawned
  }

  /** 닫혀 있는 이슈 중 하나를 균등 확률로 엽니다. 전부 열려 있으면 `null`. */
  spawnRandomIssue(rng: Rng): Issue | null {
    const closed = ISSUES.filter((issue) => !this.opened.has(issue.code))
    if (closed.length === 0) return null

    const issue = rng.pickOne(closed)
    this.open(issue.code)

    return issue
  }

  /**
   * 열린 이슈마다 `onNeglect` 를 불러 압력의 합을 만듭니다.
   *
   * 합계를 캐시하지 않는 이유는 `onNeglect` 가 재정의 가능한 메서드이기 때문입니다 —
   * `issue.neglect` 를 직접 더해 캐시하면 재정의한 이슈의 몫이 조용히 빠집니다.
   */
  applyNeglect(minutes: number, context: ResolveContext): NeglectPressure {
    const pressure = createEmptyPressure()
    for (const issue of this.openIssues) issue.onNeglect(minutes, pressure, context)

    return pressure
  }

  /** 그 날의 발생률로 다음 대기 시간을 뽑습니다. */
  private scheduleNext(from: number, day: number, rng: Rng): void {
    const perDay = Math.min(
      ISSUES_PER_DAY_CAP,
      ISSUES_PER_DAY + ISSUES_PER_DAY_GROWTH * (day - 1),
    )
    this.nextSpawnAt = from + rng.nextWaitingTime(perDay / MINUTES_PER_DAY)
  }
}

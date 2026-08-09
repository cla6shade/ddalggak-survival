import { createIssues } from './issues/IssueCatalog'
import { createEmptyPressure } from './issues/NeglectEffect'
import type { Issue } from './issues/Issue'
import type { NeglectPressure } from './issues/NeglectEffect'
import type { Session } from '@/core/Session'

/** 세이브에 실리는 이슈 상태. `Set`/`Map` 은 JSON 이 못 실어서 배열로 폅니다. */
export interface IssueManagerState {
  opened: string[]
  solved: [string, number][]
}

/**
 * 이슈들이 지금 어떤 상태인지.
 *
 * 열려 있는지(`opened`)와 몇 번 해결했는지(`solved`)를 따로 셉니다 — 해결해도
 * 목록에서 사라지지 않고 다시 열릴 수 있기 때문입니다.
 *
 * 첫 한 건 뒤에는 선택지를 시도할 때마다 닫힌 이슈 중 하나가 새로 열립니다.
 */
export class IssueManager {
  /** 이 판의 이슈 전부. 세션을 받아야 만들 수 있어 생성자에서 세웁니다. */
  private readonly all: readonly Issue[]
  private readonly opened = new Set<string>()
  private readonly solved = new Map<string, number>()
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

  /** 첫 이슈 후보 3개 중 하나를 균등 확률로 엽니다. */
  spawnInitialIssue(): Issue {
    const issue = this.session.rng.pickOne(this.all.filter((candidate) => candidate.initial))
    this.open(issue.code)

    return issue
  }

  /** 닫힌 다른 이슈 중 하나를 균등 확률로 엽니다. 후보가 없으면 `null`. */
  spawnRandomIssue(excludeCode?: string): Issue | null {
    const closed = this.all.filter(
      (issue) => issue.code !== excludeCode && !this.opened.has(issue.code),
    )
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
    }
  }

  restore(state: IssueManagerState): void {
    this.opened.clear()
    for (const code of state.opened) this.opened.add(code)

    this.solved.clear()
    for (const [code, count] of state.solved) this.solved.set(code, count)

  }
}

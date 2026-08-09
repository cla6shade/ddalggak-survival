import { MAX_STAMINA } from '@/game/stats/PlayerStatus'
import type { Session } from '@/core/Session'
import type { Issue } from '@/game/issues/Issue'
import type { IssueOption, OptionKind } from '@/game/issues/IssueOption'
import type { NeglectEffect } from '@/game/issues/NeglectEffect'
import type { RoomAction } from '@/game/actions/RoomAction'

/** 방에서 눌러 볼 수 있는 물건. `RoomActionMenus` 의 필드 이름과 같습니다. */
export type MenuKey = 'door' | 'refrigerator' | 'bed'

export const MENU_KEYS: readonly MenuKey[] = ['door', 'refrigerator', 'bed']

/**
 * 정책이 내놓는 답 하나. 게임 객체를 직접 들지 않고 **이름과 자리 번호만** 담습니다 —
 * 정책이 `Issue` 를 손에 쥐면 숨겨야 할 값(`theftChance` 등)에 닿을 수 있습니다.
 */
export type Decision =
  | { readonly kind: 'issue'; readonly issueCode: string; readonly optionIndex: number }
  | { readonly kind: 'action'; readonly menu: MenuKey; readonly actionIndex: number }
  | { readonly kind: 'wait' }

/**
 * 이슈를 그냥 뒀을 때 벌어지는 일. 시트의 「방치 시 …」 한 줄을 숫자로 편 것입니다.
 *
 * 문구가 보여 주는 축과 정확히 같습니다 — 사람은 「매출 0」을 읽고 그게 무슨 뜻인지
 * 압니다. 정책에게 한국어를 파싱시킬 이유는 없습니다.
 */
export class NeglectView {
  readonly userDeltaPerHour: number
  readonly qualityDeltaPerHour: number
  readonly revenueMultiplier: number
  readonly serverCostMultiplier: number
  readonly staminaRecoveryPenalty: number

  constructor(effect: NeglectEffect) {
    this.userDeltaPerHour = effect.userDeltaPerHour
    this.qualityDeltaPerHour = effect.qualityDeltaPerHour
    this.revenueMultiplier = effect.revenueMultiplier
    this.serverCostMultiplier = effect.serverCostMultiplier
    this.staminaRecoveryPenalty = effect.staminaRecoveryPenalty
  }

  /** 매출을 아예 끊는 이슈인지. 문구에 「매출 0」 으로 뜹니다. */
  get killsRevenue(): boolean {
    return this.revenueMultiplier === 0
  }
}

/**
 * 대응책 한 줄. 화면(`BottomSheet.renderOptionRows`)에 실제로 뜨는 값만 베껴 담습니다.
 *
 * `theftChance` · `failureEndings` · `qualityGain` 은 **필드 자체를
 * 만들지 않습니다.** 원본 `IssueOption` 을 들고 있지도 않습니다 — 참조를 남기면
 * 정책이 타입을 우회해 들여다볼 수 있고, 기록으로 새어 나가기도 합니다.
 */
export class OptionView {
  readonly index: number
  readonly title: string
  readonly kind: OptionKind
  /** 오늘 이 선택지의 성공 확률. 화면의 `%` 와 같은 값입니다. */
  readonly successRate: number
  readonly staminaCost: number
  readonly moneyCost: number
  readonly creditCost: number
  readonly minutes: number
  /** 자원이 모자라 줄이 잠겼는지. 잠긴 줄은 누를 수 없습니다. */
  readonly affordable: boolean
  readonly decision: Decision

  constructor(issue: Issue, option: IssueOption, index: number) {
    this.index = index
    this.title = option.title
    this.kind = option.kind
    this.successRate = issue.getSuccessRate(option)
    this.staminaCost = option.staminaCost
    this.moneyCost = option.moneyCost
    this.creditCost = option.creditCost
    this.minutes = option.minutes
    this.affordable = issue.isAffordable(option)
    this.decision = { kind: 'issue', issueCode: issue.code, optionIndex: index }
  }

  /** 시간당 성공 기대치. 무엇을 먼저 칠지 고르는 정책들이 씁니다. */
  get successPerHour(): number {
    return this.successRate / (this.minutes / 60)
  }
}

/** 열려 있는 이슈 한 건. 목록 화면에 뜨는 제목과 방치 문구가 전부입니다. */
export class IssueView {
  readonly code: string
  readonly title: string
  readonly neglectText: string
  /** 위 문구를 숫자로 편 것. 어느 이슈부터 칠지 고르는 데 씁니다. */
  readonly neglect: NeglectView
  readonly options: readonly OptionView[]

  constructor(issue: Issue) {
    this.code = issue.code
    this.title = issue.title
    this.neglectText = issue.getNeglectText()
    this.neglect = new NeglectView(issue.neglect)
    this.options = issue.options.map((option, index) => new OptionView(issue, option, index))
  }

  get affordableOptions(): readonly OptionView[] {
    return this.options.filter((option) => option.affordable)
  }
}

/** 방 행동 한 줄. `getCostText()` 가 화면에 적는 값들과 같습니다. */
export class ActionView {
  readonly id: string
  readonly title: string
  readonly badge: string
  readonly minutes: number
  /** 실제로 오를 체력. `자기` 처럼 그때그때 달라지는 행동도 적힌 값과 같습니다. */
  readonly staminaGain: number
  readonly moneyGain: number
  readonly affordable: boolean
  readonly decision: Decision

  constructor(action: RoomAction, menu: MenuKey, index: number) {
    this.id = action.id
    this.title = action.title
    this.badge = action.badge
    this.minutes = action.minutes
    this.staminaGain = action.getStaminaGain()
    this.moneyGain = action.moneyGain
    this.affordable = action.isAffordable()
    this.decision = { kind: 'action', menu, actionIndex: index }
  }

  /** 시간당 체력 회복. 무엇으로 쉴지 고르는 정책들이 씁니다. */
  get staminaPerHour(): number {
    return this.staminaGain / (this.minutes / 60)
  }
}

/** 물건 하나가 내놓는 목록. */
export class MenuView {
  readonly key: MenuKey
  readonly title: string
  readonly actions: readonly ActionView[]

  constructor(key: MenuKey, title: string, actions: readonly RoomAction[]) {
    this.key = key
    this.title = title
    this.actions = actions.map((action, index) => new ActionView(action, key, index))
  }
}

/**
 * 지금 화면을 보고 있는 플레이어가 아는 것 전부.
 *
 * 계기판([HudManager])이 그리는 타일 8종과 시트가 펴는 목록이 경계입니다.
 * **품질·누적 매출·누적 지출은 계기판에 없어서 여기에도 없습니다** — 품질은 해결
 * 토스트의 `품질 +N` 으로 증감만 보이고, 누적 값은 엔딩 화면에서야 나옵니다.
 * 난수가 어디까지 갔는지도 물론 없습니다.
 *
 * 만드는 동안 난수를 한 번도 굴리지 않습니다 — `getSuccessRate` · `isAffordable` ·
 * `getStaminaGain`(→ `applyNeglect(0)`) 이 전부 난수를 안 씁니다.
 */
export class PlayerView {
  static readonly WAIT: Decision = { kind: 'wait' }

  readonly day: number
  readonly minuteOfDay: number
  readonly totalMinutes: number

  readonly money: number
  readonly stamina: number
  readonly maxStamina = MAX_STAMINA
  readonly credit: number

  readonly users: number
  readonly userGrowthPerHour: number
  readonly revenuePerHour: number
  readonly serverCostPerHour: number

  /** 계기판이 전일 대비 델타를 그리는 기준. 첫날에는 없습니다. */
  readonly yesterday: {
    readonly users: number
    readonly userGrowthPerHour: number
    readonly revenuePerHour: number
    readonly serverCostPerHour: number
  } | null

  readonly issues: readonly IssueView[]
  readonly menus: readonly MenuView[]

  private constructor(session: Session) {
    const { clock, player, product } = session

    this.day = clock.day
    this.minuteOfDay = Math.floor(clock.minutes)
    this.totalMinutes = clock.totalMinutes

    this.money = player.money
    this.stamina = player.stamina
    this.credit = player.credit

    this.users = product.users
    this.userGrowthPerHour = product.userGrowthPerHour
    this.revenuePerHour = product.revenuePerHour
    this.serverCostPerHour = product.serverCostPerHour

    const past = session.yesterday
    this.yesterday = past
      ? {
          users: past.users,
          userGrowthPerHour: past.userGrowthPerHour,
          revenuePerHour: past.revenuePerHour,
          serverCostPerHour: past.serverCostPerHour,
        }
      : null

    this.issues = session.issues.openIssues.map((issue) => new IssueView(issue))
    this.menus = [
      new MenuView('door', session.menus.door.title, session.menus.door.actions),
      new MenuView(
        'refrigerator',
        session.menus.refrigerator.title,
        session.menus.refrigerator.actions,
      ),
      new MenuView('bed', session.menus.bed.title, session.menus.bed.actions),
    ]
  }

  static from(session: Session): PlayerView {
    return new PlayerView(session)
  }

  /** 이슈 버튼에 뜨는 숫자. */
  get openIssueCount(): number {
    return this.issues.length
  }

  /** 지금 실제로 누를 수 있는 방 행동 전부. */
  get affordableActions(): readonly ActionView[] {
    return this.menus.flatMap((menu) => menu.actions).filter((action) => action.affordable)
  }

  /** 잠기지 않은 선택지 전부. */
  get affordableOptions(): readonly OptionView[] {
    return this.issues.flatMap((issue) => issue.affordableOptions)
  }

  /**
   * 한 번에 가장 많이 회복하는 행동. 바닥을 쳤을 때 고를 것입니다.
   * 아이디를 박아 넣지 않고 숫자로 고릅니다 — 화면을 보는 사람도 그렇게 합니다.
   */
  get deepestRest(): ActionView | null {
    return pickBest(this.affordableActions, (action) => action.staminaGain, 0)
  }

  /** 시간당 회복이 가장 좋은 행동. 여유가 있을 때 고를 것입니다. */
  get quickestRest(): ActionView | null {
    return pickBest(this.affordableActions, (action) => action.staminaPerHour, 0)
  }

  /** 돈이 가장 많이 들어오는 행동. */
  get bestEarning(): ActionView | null {
    return pickBest(this.affordableActions, (action) => action.moneyGain, 0)
  }

  /** 지금 고를 수 있는 것 전부. 아무것도 못 누르는 판에서도 `wait` 하나는 남습니다. */
  get decisions(): readonly Decision[] {
    return [
      ...this.affordableActions.map((action) => action.decision),
      ...this.affordableOptions.map((option) => option.decision),
      PlayerView.WAIT,
    ]
  }

  findIssue(code: string): IssueView | null {
    return this.issues.find((issue) => issue.code === code) ?? null
  }

  findMenu(key: MenuKey): MenuView | null {
    return this.menus.find((menu) => menu.key === key) ?? null
  }

  findAction(id: string): ActionView | null {
    for (const menu of this.menus) {
      const action = menu.actions.find((candidate) => candidate.id === id)
      if (action) return action
    }

    return null
  }
}

/** `score` 가 가장 큰 것. `floor` 이하만 있으면 `null` — 「없는 것」과 「나쁜 것」은 다릅니다. */
function pickBest<T>(items: readonly T[], score: (item: T) => number, floor: number): T | null {
  let best: T | null = null
  let bestScore = floor

  for (const item of items) {
    const value = score(item)
    if (value > bestScore) {
      best = item
      bestScore = value
    }
  }

  return best
}

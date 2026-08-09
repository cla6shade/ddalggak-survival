import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { session } from '@/core/Session'
import type { AtlasFrame } from '@/generated/atlas'
import type { Issue } from '@/game/issues/Issue'
import type { IssueOption } from '@/game/issues/IssueOption'
import type { RoomAction, RoomActionMenu } from '@/game/actions/RoomAction'

const KIND_LABEL: Record<string, string> = { direct: '직접', ddalggak: '딸깍', gamble: '도박' }

/** 줄 아래쪽에 아이콘과 함께 서는 값 하나. */
interface CostChip {
  frame: AtlasFrame
  text: string
}

/**
 * 화면 아래에서 떠오르는 판 하나. 세 화면을 오갑니다 —
 * 열린 이슈 목록, 고른 이슈의 대응책, 그리고 방 물건 앞에서 할 수 있는 것들.
 *
 * `menu` 가 있으면 방 행동 화면, 없고 `selected` 가 있으면 대응책 화면,
 * 둘 다 없으면 이슈 목록입니다. 판을 하나만 두는 이유는 두 장이 동시에 열리면
 * 서로의 바깥 층이 상대의 클릭을 삼키기 때문입니다.
 *
 * 바깥 층(`scrim`)은 판 밖을 눌러 닫기 위한 것입니다.
 * 값을 스스로 만들지 않고 `session` 에서 읽어 그리기만 하며,
 * 누르면 `session` 으로 도로 넘깁니다.
 */
export class BottomSheet extends UiElement<'div'> {
  private readonly sheet = document.createElement('div')
  private readonly head = document.createElement('div')
  private readonly heading = document.createElement('div')
  private readonly title = document.createElement('span')
  private readonly back = document.createElement('button')
  private readonly rows = document.createElement('div')
  /** 지금 펼쳐 둔 방 물건의 목록. `null` 이면 이슈 쪽 화면입니다. */
  private menu: RoomActionMenu | null = null
  /** 지금 대응책을 펼쳐 둔 이슈. `null` 이면 목록 화면입니다. */
  private selected: Issue | null = null
  private isOpen = false

  constructor() {
    super('div', 'scrim scrim--hidden')
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')

    this.sheet.className = 'sheet'
    this.head.className = 'panel sheet__head'

    // 좌·우 버튼이 늘 자리를 차지해야 가운데 제목이 화면 한가운데에 섭니다.
    // 돌아갈 곳이 없을 때는 지우지 않고 감춥니다.
    this.back.type = 'button'
    this.back.className = 'sheet__nav'
    this.back.textContent = '←'
    this.back.setAttribute('aria-label', '이슈 목록으로')
    this.back.addEventListener('click', () => {
      this.selected = null
      this.render()
    })

    this.heading.className = 'sheet__heading'
    this.title.className = 'sheet__title'
    this.heading.append(this.title)

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'sheet__nav'
    close.textContent = '✕'
    close.setAttribute('aria-label', '닫기')
    close.addEventListener('click', () => this.hide())

    this.head.append(this.back, this.heading, close)

    this.rows.className = 'sheet__rows'
    this.sheet.append(this.head, this.rows)
    this.element.append(this.sheet)

    // 판 바깥을 누르면 닫습니다. 안쪽 클릭은 여기까지 올라오지 않아야 합니다.
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) this.hide()
    })
  }

  /** 계기판의 알림 버튼. 이슈 화면이 떠 있으면 닫고, 아니면 이슈 목록을 폅니다. */
  toggle(): void {
    if (this.isOpen && this.menu === null) this.hide()
    else this.showIssues()
  }

  showIssues(): void {
    this.menu = null
    this.selected = null
    this.open()
  }

  /** 방 물건 앞에 섰습니다. 그 물건이 내놓는 것들을 폅니다. */
  showMenu(menu: RoomActionMenu): void {
    this.menu = menu
    this.selected = null
    this.open()
  }

  hide(): void {
    this.isOpen = false
    this.toggleClass('scrim--hidden', true)
  }

  /** 세션이 무엇이든 바꿨을 때. 열려 있지 않으면 그릴 이유가 없습니다. */
  render(): void {
    if (!this.isOpen) return

    if (this.menu) {
      this.renderHead(this.menu.title, false)
      this.rows.replaceChildren(...this.renderActionRows(this.menu))

      return
    }

    // 손대는 사이에 해결됐으면 목록으로 돌아갑니다.
    if (this.selected && !session.issues.isOpen(this.selected.code)) this.selected = null

    if (this.selected) {
      this.renderHead(this.selected.title, true)
      this.rows.replaceChildren(
        this.renderIssueDescription(this.selected),
        ...this.renderOptionRows(this.selected),
      )
    } else {
      this.renderHead(`이슈 ${session.issues.count}건`, false)
      this.rows.replaceChildren(...this.renderIssueRows())
    }
  }

  /** 기획안에 적힌 이슈 설명. 선택지보다 먼저 읽히는 한 덩어리입니다. */
  private renderIssueDescription(issue: Issue): HTMLDivElement {
    const description = document.createElement('div')
    description.className = 'panel issue-description'
    description.append(
      createSpan('issue-description__label', '이슈 발생'),
      createSpan('issue-description__text', issue.description),
    )

    return description
  }

  private open(): void {
    this.isOpen = true
    this.toggleClass('scrim--hidden', false)
    this.render()
  }

  /**
   * 머리글은 목업대로 좌(목록) · 중앙(경고 아이콘 + 이름) · 우(닫기) 3열입니다.
   * 경고 아이콘은 이슈를 펼쳤을 때만 답니다 — 방 행동에는 경고할 것이 없습니다.
   */
  private renderHead(title: string, canGoBack: boolean): void {
    this.back.hidden = !canGoBack
    this.title.textContent = title

    const alert = canGoBack ? new HudIcon(session.icons, 'hud_issue', 'icon icon--sm').element : null
    this.heading.replaceChildren(...(alert ? [alert, this.title] : [this.title]))
  }

  /** 목록 화면 — 열린 이슈마다 한 줄. 방치 페널티는 여기서 읽습니다. */
  private renderIssueRows(): HTMLElement[] {
    return session.issues.openIssues.map((issue) => {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'panel issue'
      row.append(
        createSpan('issue__title', issue.title),
        createSpan('issue__blurb', `방치 시 ${issue.getNeglectText()}`),
      )
      row.addEventListener('click', () => {
        this.selected = issue
        this.render()
      })

      return row
    })
  }

  /** 대응책 화면 — 제목·소모 자원·성공률·종류. */
  private renderOptionRows(issue: Issue): HTMLElement[] {
    return issue.options.map((option) => {
      const chance = issue.getSuccessRate(option)
      const row = this.createOptionRow(
        option.title,
        createChipRow(getCostChips(option)),
        // 자원이 모자라면 잠급니다.
        !issue.isAffordable(option),
      )

      const odds = createSpan(`odds__value odds--${getGrade(chance)}`, `${Math.round(chance * 100)}%`)
      const kind = createSpan(`kind kind--${option.kind}`, KIND_LABEL[option.kind] ?? option.kind)

      row.append(odds, kind)
      row.addEventListener('click', () => session.chooseOption(issue, option))

      return row
    })
  }

  /**
   * 방 행동 화면 — 물건 앞에서 할 수 있는 것들.
   * 성공률이 없는 행동이라 오른쪽 큰 숫자 자리를 비웁니다.
   */
  private renderActionRows(menu: RoomActionMenu): HTMLElement[] {
    return menu.actions.map((action) => {
      const row = this.createOptionRow(
        action.title,
        createSpan('option__note', action.getCostText()),
        !action.isAffordable(),
      )

      row.append(createSpan('odds__value', ''), createSpan('kind', action.badge))
      row.addEventListener('click', () => this.choose(action))

      return row
    })
  }

/**
   * 줄 하나의 왼쪽 절반. 오른쪽(성공률·배지)은 부르는 쪽이 붙입니다.
   * 어디에 놓일지는 CSS 의 `grid-template-areas` 가 정하므로 붙이는 순서는 상관없습니다.
   */
  private createOptionRow(title: string, note: HTMLElement, locked: boolean): HTMLButtonElement {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'panel option'
    row.disabled = locked
    row.append(createSpan('option__label', title), note)

    return row
  }

  /** 판을 닫아야 방에서 벌어지는 일이 보입니다. */
  private choose(action: RoomAction): void {
    this.hide()
    session.performAction(action)
  }
}

function createSpan(className: string, text: string): HTMLSpanElement {
  const element = document.createElement('span')
  element.className = className
  element.textContent = text

  return element
}

function createChipRow(chips: readonly CostChip[]): HTMLElement {
  const row = document.createElement('span')
  row.className = 'option__chips'

  for (const chip of chips) {
    const item = document.createElement('span')
    item.className = 'chip'
    item.append(
      new HudIcon(session.icons, chip.frame, 'icon icon--sm').element,
      createSpan('chip__text', chip.text),
    )
    row.append(item)
  }

  return row
}

/**
 * 선택지 하나가 무엇을 얼마나 쓰는지. 0 인 자원은 줄이 길어지기만 해서 뺍니다.
 *
 * **엔딩으로 이어지는 확률(`theftChance`)은 절대 넣지 않습니다.**
 * 무엇을 걸고 누르는지는 눌러 봐야 압니다.
 */
function getCostChips(option: IssueOption): CostChip[] {
  const chips: CostChip[] = []
  if (option.staminaCost > 0) {
    chips.push({ frame: 'resource_stamina', text: `-${option.staminaCost}` })
  }
  if (option.moneyCost > 0) {
    chips.push({ frame: 'resource_money', text: `-${option.moneyCost.toLocaleString('ko-KR')}원` })
  }
  if (option.creditCost > 0) {
    chips.push({ frame: 'resource_credit', text: `-${option.creditCost}` })
  }
  chips.push({ frame: 'resource_time', text: `${Math.round((option.minutes / 60) * 10) / 10}시간` })

  return chips
}

/** 성공률을 CSS 수식 클래스용 등급으로. */
function getGrade(chance: number): 'poor' | 'fair' | 'good' {
  if (chance < 0.35) return 'poor'
  if (chance < 0.6) return 'fair'

  return 'good'
}

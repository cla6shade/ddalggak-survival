import { UiElement } from '../UiElement'
import { session } from '@/core/Session'
import type { Issue } from '@/game/issues/Issue'
import type { IssueOption } from '@/game/issues/IssueOption'
import type { RoomAction, RoomActionMenu } from '@/game/actions/RoomAction'

const KIND_LABEL: Record<string, string> = { direct: '직접', ddalggak: '딸깍', gamble: '도박' }

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
  private readonly title = document.createElement('span')
  private readonly hint = document.createElement('span')
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

    const head = document.createElement('div')
    head.className = 'panel sheet__head'

    this.title.className = 'sheet__title'
    this.hint.className = 'sheet__hint'

    this.back.type = 'button'
    this.back.className = 'sheet__close'
    this.back.textContent = '← 목록'
    this.back.addEventListener('click', () => {
      this.selected = null
      this.render()
    })

    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'sheet__close'
    close.textContent = '닫기'
    close.addEventListener('click', () => this.hide())

    head.append(this.title, this.hint, this.back, close)

    this.rows.className = 'sheet__rows'
    this.sheet.append(head, this.rows)
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
      this.renderHead(this.menu.title, this.menu.hint, false)
      this.rows.replaceChildren(...this.renderActionRows(this.menu))

      return
    }

    // 손대는 사이에 해결됐으면 목록으로 돌아갑니다.
    if (this.selected && !session.issues.isOpen(this.selected.code)) this.selected = null

    if (this.selected) {
      this.renderHead(this.selected.title, `방치 시 ${this.selected.getNeglectText()}`, true)
      this.rows.replaceChildren(...this.renderOptionRows(this.selected))
    } else {
      this.renderHead('이슈', `${session.issues.count}개 열려 있음`, false)
      this.rows.replaceChildren(...this.renderIssueRows())
    }
  }

  private open(): void {
    this.isOpen = true
    this.toggleClass('scrim--hidden', false)
    this.render()
  }

  private renderHead(title: string, hint: string, canGoBack: boolean): void {
    this.back.hidden = !canGoBack
    this.title.textContent = title
    this.hint.textContent = hint
  }

  /** 목록 화면 — 열린 이슈마다 한 줄. */
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

  /** 대응책 화면 — 선택지마다 종류·성공률·소모 자원. */
  private renderOptionRows(issue: Issue): HTMLElement[] {
    const day = session.clock.day

    return issue.options.map((option) => {
      const chance = issue.getSuccessRate(option, day)
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'panel option'
      // 자원이 모자라면 잠급니다.
      row.disabled = !issue.isAffordable(option, session.player)

      const body = document.createElement('div')
      body.className = 'option__body'
      body.append(
        createSpan('option__label', option.title),
        createSpan('option__note', formatCost(option)),
      )

      const odds = document.createElement('div')
      odds.className = `odds odds--${getGrade(chance)}`
      odds.append(
        createSpan('odds__value', `${Math.round(chance * 100)}%`),
        createSpan('odds__caption', '성공'),
      )

      const kind = createSpan(`kind kind--${option.kind}`, KIND_LABEL[option.kind] ?? option.kind)
      row.append(kind, body, odds)
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
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'panel option'
      row.disabled = !action.isAffordable(session.player)

      const body = document.createElement('div')
      body.className = 'option__body'
      body.append(
        createSpan('option__label', action.title),
        createSpan('option__note', action.getCostText()),
      )

      row.append(createSpan('kind', action.badge), body)
      row.addEventListener('click', () => this.choose(action))

      return row
    })
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

/** 성공률을 CSS 수식 클래스용 등급으로. */
function getGrade(chance: number): 'poor' | 'fair' | 'good' {
  if (chance < 0.35) return 'poor'
  if (chance < 0.6) return 'fair'

  return 'good'
}

function formatCost(option: IssueOption): string {
  const parts: string[] = []
  if (option.staminaCost > 0) parts.push(`체력 ${option.staminaCost}`)
  if (option.moneyCost > 0) parts.push(`${option.moneyCost.toLocaleString('ko-KR')}원`)
  if (option.creditCost > 0) parts.push(`크레딧 ${option.creditCost}`)
  parts.push(`${Math.round((option.minutes / 60) * 10) / 10}시간`)

  return parts.join(' · ')
}

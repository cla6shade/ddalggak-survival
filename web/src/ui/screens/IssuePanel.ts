import { UiElement } from '../UiElement'
import { session } from '@/core/Session'
import type { Issue } from '@/game/issues/Issue'
import type { IssueOption } from '@/game/issues/IssueOption'

const KIND_LABEL: Record<string, string> = { direct: '직접', ddalggak: '딸깍', gamble: '도박' }

/**
 * 두 화면을 오가는 판 — 열린 이슈 목록, 그리고 고른 이슈의 대응책.
 * `selected` 가 `null` 이냐로 갈립니다.
 *
 * 바깥 층(`scrim`)은 판 밖을 눌러 닫기 위한 것입니다.
 * 값을 스스로 만들지 않고 `session` 에서 읽어 그리기만 하며,
 * 누르면 `session.chooseOption` 으로 넘깁니다.
 */
export class IssuePanel extends UiElement<'div'> {
  private readonly sheet = document.createElement('div')
  private readonly title = document.createElement('span')
  private readonly hint = document.createElement('span')
  private readonly back = document.createElement('button')
  private readonly rows = document.createElement('div')
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

  toggle(): void {
    if (this.isOpen) this.hide()
    else this.show()
  }

  show(): void {
    this.isOpen = true
    this.selected = null
    this.toggleClass('scrim--hidden', false)
    this.render()
  }

  hide(): void {
    this.isOpen = false
    this.toggleClass('scrim--hidden', true)
  }

  /** 세션이 무엇이든 바꿨을 때. 열려 있지 않으면 그릴 이유가 없습니다. */
  render(): void {
    if (!this.isOpen) return

    // 손대는 사이에 해결됐으면 목록으로 돌아갑니다.
    if (this.selected && !session.issues.isOpen(this.selected.code)) this.selected = null

    this.back.hidden = this.selected === null
    this.title.textContent = this.selected ? this.selected.title : '이슈'
    this.hint.textContent = this.selected
      ? `방치 시 ${this.selected.getNeglectText()}`
      : `${session.issues.count}개 열려 있음`

    this.rows.replaceChildren(
      ...(this.selected ? this.renderOptionRows(this.selected) : this.renderIssueRows()),
    )
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

import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { EndingResult } from '@/game/endings/Ending'

/**
 * 한 판이 끝난 뒤 결과를 고정해서 보여 주는 전체 화면.
 *
 * 문구는 엔딩이 들고 옵니다 — 화면은 어떤 엔딩이 있는지 알 필요가 없습니다.
 */
export class EndingScreen extends UiElement<'section'> {
  constructor(
    private readonly icons: IconSheet,
    private readonly onRestart: () => void,
  ) {
    super('section', 'ending ending--hidden')
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-labelledby', 'ending-title')
  }

  show(result: EndingResult): void {
    const { presentation } = result.ending
    const { snapshot } = result

    const card = document.createElement('div')
    card.className = 'ending__card'

    const visual = presentation.frame
      ? new HudIcon(this.icons, presentation.frame, 'ending__icon').element
      : createMissingVisual()

    const eyebrow = document.createElement('span')
    eyebrow.className = 'ending__eyebrow'
    eyebrow.textContent = presentation.eyebrow

    const title = document.createElement('h1')
    title.id = 'ending-title'
    title.className = 'ending__title'
    title.textContent = presentation.title

    const description = document.createElement('p')
    description.className = 'ending__description'
    description.textContent = presentation.description

    const stats = document.createElement('dl')
    stats.className = 'ending__stats'
    stats.append(
      createStat('생존', `${snapshot.day}일`),
      createStat('최종 잔고', `${formatAmount(snapshot.money)}원`),
      createStat('최종 체력', formatAmount(snapshot.stamina)),
      createStat('이용자', `${formatAmount(snapshot.users)}명`),
      createStat('누적 매출', `${formatAmount(snapshot.revenue)}원`),
      createStat('해결한 이슈', `${formatAmount(snapshot.solvedIssues)}건`),
    )

    const restart = document.createElement('button')
    restart.type = 'button'
    restart.className = 'ending__restart'
    restart.textContent = '처음부터 다시 시작'
    restart.addEventListener('click', this.onRestart)

    card.append(visual, eyebrow, title, description, stats, restart)
    this.element.replaceChildren(card)
    this.toggleClass('ending--hidden', false)
    restart.focus()
  }
}

function createMissingVisual(): HTMLDivElement {
  const visual = document.createElement('div')
  visual.className = 'ending__missing-visual'
  visual.textContent = '엔딩 이미지 추가 필요'
  return visual
}

function createStat(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'ending__stat'

  const term = document.createElement('dt')
  term.textContent = label
  const detail = document.createElement('dd')
  detail.textContent = value
  row.append(term, detail)

  return row
}

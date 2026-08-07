import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'
import type { EndingId, EndingResult } from '@/game/endings/Ending'

interface EndingPresentation {
  frame: AtlasFrame
  eyebrow: string
  title: string
  description: string
}

const PRESENTATION: Record<EndingId, EndingPresentation> = {
  bankrupt: {
    frame: 'ending_bankrupt',
    eyebrow: '운영 종료',
    title: '파산했습니다',
    description: '잔고가 바닥났습니다. 서버비도, 다음 시도도 더는 감당할 수 없습니다.',
  },
  burnout: {
    frame: 'ending_burnout',
    eyebrow: '운영 종료',
    title: '번아웃이 왔습니다',
    description: '체력이 바닥났습니다. 대표가 쓰러지면서 서비스 운영도 함께 멈췄습니다.',
  },
}

/** 한 판이 끝난 뒤 결과를 고정해서 보여 주는 전체 화면. */
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
    const copy = PRESENTATION[result.id]
    const { snapshot } = result

    const card = document.createElement('div')
    card.className = 'ending__card'

    const icon = new HudIcon(this.icons, copy.frame, 'ending__icon')

    const eyebrow = document.createElement('span')
    eyebrow.className = 'ending__eyebrow'
    eyebrow.textContent = copy.eyebrow

    const title = document.createElement('h1')
    title.id = 'ending-title'
    title.className = 'ending__title'
    title.textContent = copy.title

    const description = document.createElement('p')
    description.className = 'ending__description'
    description.textContent = copy.description

    const stats = document.createElement('dl')
    stats.className = 'ending__stats'
    stats.append(
      createStat('생존', `${snapshot.day}일`),
      createStat('최종 잔고', `${formatAmount(snapshot.money)}원`),
      createStat('최종 체력', formatAmount(snapshot.stamina)),
      createStat('이용자', `${formatAmount(snapshot.users, 1)}명`),
      createStat('누적 매출', `${formatAmount(snapshot.revenue)}원`),
      createStat('해결한 이슈', `${formatAmount(snapshot.solvedIssues)}건`),
    )

    const restart = document.createElement('button')
    restart.type = 'button'
    restart.className = 'ending__restart'
    restart.textContent = '처음부터 다시 시작'
    restart.addEventListener('click', this.onRestart)

    card.append(icon.element, eyebrow, title, description, stats, restart)
    this.element.replaceChildren(card)
    this.toggleClass('ending--hidden', false)
    restart.focus()
  }
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

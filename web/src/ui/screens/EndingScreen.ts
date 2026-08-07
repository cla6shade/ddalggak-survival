import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'
import type { EndingId, EndingResult } from '@/game/endings/Ending'

interface EndingPresentation {
  frame?: AtlasFrame
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
  hacked: {
    eyebrow: '보안 사고',
    title: '서비스가 해킹당했습니다',
    description: 'AI로 개발한 코드에 남은 보안 허점을 통해 공격자가 시스템에 침입했습니다.',
  },
  'idea-stolen': {
    eyebrow: '아이디어 도난',
    title: '전문가에게 뒤통수를 맞았습니다',
    description: '도움을 요청한 전문가가 서비스 아이디어를 가져가 먼저 사업을 시작했습니다.',
  },
  lawsuit: {
    eyebrow: '법적 분쟁',
    title: '아이디어 도용 소송을 당했습니다',
    description: '다른 회사가 자사의 아이디어와 동일하다며 소송을 제기해 운영을 계속할 수 없게 됐습니다.',
  },
  'consumer-report': {
    eyebrow: '고객 신고',
    title: '소비자보호원에 신고됐습니다',
    description: '전화 응대 과정에서 불만이 커진 고객이 소비자보호원에 서비스를 신고했습니다.',
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

    const visual = copy.frame
      ? new HudIcon(this.icons, copy.frame, 'ending__icon').element
      : createMissingVisual()

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

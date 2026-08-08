import { UiElement } from '../UiElement'
import type { IconSheet } from '@/assets/IconSheet'

/** 빛이 화면을 다 덮기까지 걸리는 시간(ms). CSS 의 `intro-burst` 와 같아야 합니다. */
const BURST = 560

/** 빛이 덮은 뒤 인트로가 걷히기까지 걸리는 시간(ms). CSS 의 `.intro--done` 과 같아야 합니다. */
const FADE = 360

/**
 * 판을 열기 전에 서는 첫 화면.
 *
 * 목업(`시작.svg`, 360×800)의 세 덩어리를 그대로 옮겼습니다 — 대사, 캐릭터, 그리고
 * 시작 버튼. 버튼을 누르면 한가운데서 빛이 퍼져 화면을 덮고, 그 빛 뒤에서 판이 켜집니다.
 * 방이 그려지는 첫 프레임을 빛이 가려 주므로 화면이 덜컥 바뀌지 않습니다.
 *
 * 판을 직접 켜지 않고 `onStart` 를 부르기만 합니다 — 이 화면은 언제 시작하는지만 알고,
 * 무엇을 시작하는지는 모릅니다.
 */
export class IntroScreen extends UiElement<'section'> {
  /** 두 번 눌러도 한 번만 넘어가려고 들고 있습니다. */
  private started = false

  constructor(
    icons: IconSheet,
    private readonly onStart: () => void,
  ) {
    super('section', 'intro')

    const script = document.createElement('div')
    script.className = 'intro__script'
    script.append(
      createLine('intro__line', '이 아이디어 미쳤다…', 'AI 딸깍해서 만들면 억만장자 되는 거 아니야?'),
      createLine('intro__line intro__line--punch', '당장 해보자 !!'),
    )

    const character = document.createElement('img')
    character.className = 'intro__character'
    character.alt = ''
    character.src = icons.getUrl('start_character') ?? ''

    const start = document.createElement('button')
    start.type = 'button'
    start.className = 'intro__start'

    const bolt = document.createElement('img')
    bolt.className = 'intro__bolt'
    bolt.alt = ''
    bolt.src = icons.getUrl('action_ddalggak') ?? ''

    const label = document.createElement('span')
    label.className = 'intro__label'
    label.textContent = '딸깍 !!!'

    start.append(bolt, label)
    start.addEventListener('click', () => this.begin())

    // 빛은 내용보다 뒤에 붙습니다 — 퍼지는 동안 대사와 캐릭터를 덮어야 합니다.
    const burst = document.createElement('div')
    burst.className = 'intro__burst'

    this.element.append(script, character, start, burst)
  }

  /** 빛을 퍼뜨리고, 다 덮은 뒤에 판을 켭니다. 이미 눌렀으면 아무 일도 하지 않습니다. */
  private begin(): void {
    if (this.started) return
    this.started = true

    this.toggleClass('intro--starting', true)
    window.setTimeout(() => {
      this.onStart()
      // 판이 켜진 다음에 걷습니다. 순서가 바뀌면 빈 화면이 한 번 비칩니다.
      this.toggleClass('intro--done', true)
      window.setTimeout(() => this.element.remove(), FADE)
    }, BURST)
  }
}

function createLine(className: string, ...lines: string[]): HTMLParagraphElement {
  const paragraph = document.createElement('p')
  paragraph.className = className

  lines.forEach((line, index) => {
    if (index > 0) paragraph.append(document.createElement('br'))
    paragraph.append(line)
  })

  return paragraph
}

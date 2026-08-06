import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/** 한 장이 화면에 머무는 시간(ms). */
const LIFETIME = 3000

/** 사라지는 애니메이션 길이. CSS 의 `toast-out` 과 같아야 합니다. */
const FADE = 260

export type ToastTone = 'issue' | 'good' | 'bad'

/** 톤마다 다른 그림. 글자를 읽기 전에 이게 먼저 눈에 걸려야 합니다. */
const TONE_ICON: Record<ToastTone, AtlasFrame> = {
  issue: 'issue_high',
  good: 'effect_success',
  bad: 'effect_failure',
}

interface Toast {
  title: string
  body: string
  tone: ToastTone
}

/**
 * 방금 무슨 일이 있었는지 화면 한가운데에 한 번 띄웁니다. 입력은 받지 않습니다.
 *
 * 이슈는 시간이 흐르는 동안 조용히 터집니다. 계기판의 숫자만 1 올라가서는
 * **무엇이** 터졌는지 알 수 없어서, 터진 순간 그림과 이름을 함께 보여 줍니다.
 *
 * 선택지 하나를 누르면 알림이 한꺼번에 몰립니다(실패 → 이슈 발생 → 아이디어 도난).
 * 겹쳐 쌓지 않고 대기열에 넣어 **들어온 순서대로 한 장씩** 보여 줍니다 —
 * 겹치면 무엇이 무엇인지 못 읽고, 밀어내면 못 보고 지나갑니다.
 */
export class ToastStack extends UiElement<'div'> {
  private readonly queue: Toast[] = []
  private isShowing = false

  constructor(private readonly icons: IconSheet) {
    super('div', 'toasts')
    // 화면을 보고 있지 않아도 무엇이 터졌는지 읽히도록. 진행 중인 조작은 끊지 않습니다.
    this.element.setAttribute('role', 'status')
    this.element.setAttribute('aria-live', 'polite')
  }

  /** `title` 은 무슨 일이 벌어졌는지, `body` 는 무엇에 벌어졌는지. */
  push(title: string, body: string, tone: ToastTone = 'issue'): void {
    this.queue.push({ title, body, tone })
    if (!this.isShowing) this.showNext()
  }

  /** 대기열에서 한 장을 꺼내 띄우고, 다 지나가면 스스로 다음 장을 부릅니다. */
  private showNext(): void {
    const toast = this.queue.shift()
    if (!toast) {
      this.isShowing = false
      return
    }

    this.isShowing = true
    const card = this.createCard(toast)
    this.element.append(card)

    window.setTimeout(() => {
      card.classList.add('toast--out')
      window.setTimeout(() => {
        card.remove()
        this.showNext()
      }, FADE)
    }, LIFETIME)
  }

  private createCard(toast: Toast): HTMLDivElement {
    const card = document.createElement('div')
    card.className = `toast toast--${toast.tone}`

    const heading = document.createElement('strong')
    heading.className = 'toast__title'
    heading.textContent = toast.title

    const text = document.createElement('span')
    text.className = 'toast__body'
    text.textContent = toast.body

    const icon = new HudIcon(this.icons, TONE_ICON[toast.tone], 'icon toast__icon')
    card.append(icon.element, heading, text)

    return card
  }
}

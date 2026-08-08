import { UiElement } from '../UiElement'

/** 한 장이 화면에 머무는 시간(ms). */
const LIFETIME = 3000

/** 사라지는 애니메이션 길이. CSS 의 `toast-out` 과 같아야 합니다. */
const FADE = 260

/** 동시에 세워 두는 최대 장수. */
const MAX_VISIBLE = 3

export type ToastTone = 'issue' | 'good' | 'bad'

/**
 * 방금 무슨 일이 있었는지 화면 맨 위에 쌓아 올립니다. 입력은 받지 않습니다.
 *
 * 이슈는 시간이 흐르는 동안 조용히 터집니다. 계기판의 숫자만 1 올라가서는
 * **무엇이** 터졌는지 알 수 없어서, 터진 순간 이름을 보여 줍니다.
 *
 * 선택지 하나를 누르면 알림이 한꺼번에 몰립니다(실패 → 이슈 발생 → 아이디어 도난).
 * 한 장씩 줄 세우면 마지막 장이 몇 초 뒤에야 뜨므로, 들어온 즉시 겹쳐 쌓고
 * {@link MAX_VISIBLE} 을 넘기면 **가장 오래된 것부터** 걷습니다 — 방금 벌어진 일이
 * 항상 화면에 있어야 합니다.
 */
export class ToastStack extends UiElement<'div'> {
  /** 지금 서 있는 장들. 앞이 가장 오래된 것입니다. */
  private readonly live: HTMLDivElement[] = []

  constructor() {
    super('div', 'toasts')
    // 화면을 보고 있지 않아도 무엇이 터졌는지 읽히도록. 진행 중인 조작은 끊지 않습니다.
    this.element.setAttribute('role', 'status')
    this.element.setAttribute('aria-live', 'polite')
  }

  /** `title` 은 무슨 일이 벌어졌는지, `body` 는 무엇에 벌어졌는지. */
  push(title: string, body: string, tone: ToastTone = 'issue'): void {
    const card = this.createCard(title, body, tone)
    this.element.append(card)
    this.live.push(card)

    for (const stale of this.live.slice(0, -MAX_VISIBLE)) this.dismiss(stale)
    window.setTimeout(() => this.dismiss(card), LIFETIME)
  }

  /** 한 장을 걷습니다. 이미 걷힌 장은 그냥 지나갑니다 — 수명과 밀려남이 겹칩니다. */
  private dismiss(card: HTMLDivElement): void {
    const index = this.live.indexOf(card)
    if (index < 0) return

    this.live.splice(index, 1)
    card.classList.add('toast--out')
    window.setTimeout(() => card.remove(), FADE)
  }

  private createCard(title: string, body: string, tone: ToastTone): HTMLDivElement {
    const card = document.createElement('div')
    card.className = `toast toast--${tone}`

    const heading = document.createElement('strong')
    heading.className = 'toast__title'
    heading.textContent = title

    const text = document.createElement('span')
    text.className = 'toast__body'
    text.textContent = body

    card.append(heading, text)

    return card
  }
}

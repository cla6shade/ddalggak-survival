import { UiElement } from '../UiElement'

/** 한 장이 화면에 머무는 시간(ms). */
const LIFETIME = 3000

/** 사라지는 애니메이션 길이. CSS 의 `toast-out` 과 같아야 합니다. */
const FADE = 260

/** 동시에 세워 두는 최대 장수. */
const MAX_VISIBLE = 3

export type ToastTone = 'issue' | 'good' | 'bad'

/**
 * 방금 무슨 일이 있었는지 이슈 버튼 바로 위에 쌓아 올립니다. 입력은 받지 않습니다.
 * 눈이 이미 손가락 쪽에 있고, 계기판 밑에 세우면 자원·지표 숫자에 묻힙니다.
 *
 * 이슈는 선택 결과와 함께 새로 터집니다. 계기판의 숫자만 1 올라가서는
 * **무엇이** 생겼는지 알 수 없어서, 터진 순간 이름을 보여 줍니다.
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

  /**
   * 서 있는 것을 전부 걷습니다.
   *
   * 이슈 판이 같은 자리에 서기 때문입니다 — 판이 열리면 알림은 그 아래 깔려
   * 읽히지도, 닫히는 것도 보이지도 않습니다.
   *
   * 걷는 사이에 {@link live} 가 줄어들므로 사본을 돕니다.
   */
  clear(): void {
    for (const card of [...this.live]) this.dismiss(card)
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

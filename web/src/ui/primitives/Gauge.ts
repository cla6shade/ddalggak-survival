import { UiElement } from '../UiElement'

/** 채움 막대의 `width` 만 바꿉니다 — 요소를 갈아 끼우면 CSS 트랜지션이 끊깁니다. */
export class Gauge extends UiElement<'span'> {
  private readonly fill = document.createElement('span')

  constructor() {
    super('span', 'gauge')
    this.fill.className = 'gauge__fill'
    this.element.append(this.fill)
  }

  /** `share` 는 0~1. 밖에서 어긋난 값이 와도 여기서 잘라 냅니다. */
  setRatio(share: number): void {
    const width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`
    if (this.fill.style.width !== width) this.fill.style.width = width
  }
}

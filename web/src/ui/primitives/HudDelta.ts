import { UiElement } from '../UiElement'
import { formatAmount } from '../format/formatAmount'

/** 어제 대비 증감. `moreIsGood` 에 따라 up/down 수식 클래스가 뒤집힙니다. */
export class HudDelta extends UiElement<'span'> {
  constructor() {
    super('span', 'tile__delta')
  }

  /**
   * `delta` 가 `null` 이면 비교할 어제가 없다는 뜻이라 아무것도 안 씁니다.
   * `0` 과 "어제 없음" 은 다른 말이지만, 화면에서는 둘 다 비웁니다.
   */
  setDelta(delta: number | null, moreIsGood: boolean): void {
    const rounded = delta === null ? 0 : Math.round(delta)
    const text = rounded === 0 ? '' : `${rounded > 0 ? '+' : ''}${formatAmount(rounded)}`

    if (this.element.textContent !== text) this.element.textContent = text

    this.toggleClass('tile__delta--up', moreIsGood ? rounded > 0 : rounded < 0)
    this.toggleClass('tile__delta--down', moreIsGood ? rounded < 0 : rounded > 0)
  }
}

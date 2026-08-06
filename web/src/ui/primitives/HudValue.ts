import { UiElement } from '../UiElement'

/** 계기판에서 실제로 바뀌는 숫자. 같은 값이면 DOM 을 건드리지 않습니다. */
export class HudValue extends UiElement<'span'> {
  constructor() {
    super('span', 'tile__value')
    this.element.textContent = '—'
  }

  setText(text: string): void {
    if (this.element.textContent !== text) this.element.textContent = text
  }
}

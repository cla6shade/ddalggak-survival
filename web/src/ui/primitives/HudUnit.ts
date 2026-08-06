import { UiElement } from '../UiElement'

/** 값 뒤에 작게 붙는 단위 — `원`, `개`, `/ 100`. */
export class HudUnit extends UiElement<'span'> {
  constructor(text: string) {
    super('span', 'tile__unit')
    this.element.textContent = text
  }

  setText(text: string): void {
    if (this.element.textContent !== text) this.element.textContent = text
  }
}

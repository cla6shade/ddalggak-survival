import { UiElement } from '../UiElement'

/** 값에 붙는 이름표. */
export class HudLabel extends UiElement<'span'> {
  constructor(text: string) {
    super('span', 'tile__label')
    this.element.textContent = text
  }

  setText(text: string): void {
    if (this.element.textContent !== text) this.element.textContent = text
  }
}

import { UiElement } from '../UiElement'

/** HUD 의 가로 한 줄. `modifier` 로 줄마다 다른 정렬·간격을 겁니다. */
export class HudRow extends UiElement {
  constructor(modifier: string, children: readonly UiElement<keyof HTMLElementTagNameMap>[]) {
    super('div', `hud__row hud__row--${modifier}`)
    this.append(...children)
  }
}

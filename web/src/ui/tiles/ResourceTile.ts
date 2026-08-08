import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { HudLabel } from '../primitives/HudLabel'
import { HudValue } from '../primitives/HudValue'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/**
 * 자원 하나. 아이콘과 이름이 윗줄, 값이 아랫줄입니다 — 값이 카드의 한가운데를
 * 차지해야 셋을 한 번에 훑을 수 있습니다.
 *
 * `warnAt` 이하로 떨어지면 `resource--warn` 이 붙습니다.
 */
export class ResourceTile extends UiElement {
  /** 상속받는 쪽이 값 아래에 더 얹습니다 (체력 게이지). */
  protected readonly body = document.createElement('div')
  private readonly value = new HudValue()
  private readonly warnAt: number

  constructor(
    icons: IconSheet,
    key: 'money' | 'stamina' | 'credit',
    frame: AtlasFrame,
    label: string,
    warnAt: number,
  ) {
    super('div', `tile resource resource--${key}`)
    this.warnAt = warnAt

    this.body.className = 'resource__body'

    const head = document.createElement('div')
    head.className = 'resource__head'
    head.append(new HudIcon(icons, frame, 'icon icon--sm').element, new HudLabel(label).element)

    const amount = document.createElement('div')
    amount.className = 'resource__amount'
    amount.append(this.value.element)

    this.body.append(head, amount)
    this.element.append(this.body)
  }

  setValue(value: number): void {
    this.value.setText(formatAmount(value))
    this.toggleClass('resource--warn', value <= this.warnAt)
  }
}

import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { HudLabel } from '../primitives/HudLabel'
import { HudValue } from '../primitives/HudValue'
import { HudUnit } from '../primitives/HudUnit'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/** 자원 하나. `warnAt` 이하로 떨어지면 `resource--warn` 이 붙습니다. */
export class ResourceTile extends UiElement {
  /** 상속받는 쪽이 여기에 더 얹습니다 (체력 게이지). */
  protected readonly body = document.createElement('div')
  private readonly value = new HudValue()
  private readonly warnAt: number

  constructor(
    icons: IconSheet,
    key: 'money' | 'stamina' | 'credit',
    frame: AtlasFrame,
    label: string,
    unit: string,
    warnAt: number,
  ) {
    super('div', `tile resource resource--${key}`)
    this.warnAt = warnAt

    this.body.className = 'resource__body'

    const amount = document.createElement('div')
    amount.className = 'resource__amount'
    amount.append(this.value.element, new HudUnit(unit).element)

    this.body.append(new HudLabel(label).element, amount)
    this.element.append(new HudIcon(icons, frame, 'icon icon--md').element, this.body)
  }

  setValue(value: number): void {
    this.value.setText(formatAmount(value))
    this.toggleClass('resource--warn', value <= this.warnAt)
  }
}

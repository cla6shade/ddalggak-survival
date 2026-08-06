import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { HudLabel } from '../primitives/HudLabel'
import { HudValue } from '../primitives/HudValue'
import { HudUnit } from '../primitives/HudUnit'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/**
 * 시간당 변화량 타일. `MetricTile` 과 달리 어제와 비교하지 않고, 부호에 따라
 * `rate--up`/`rate--down` 을 겁니다. 단위는 `/시간` 고정입니다.
 */
export class RateTile extends UiElement {
  private readonly value = new HudValue()

  constructor(icons: IconSheet, frame: AtlasFrame, label: string) {
    super('div', 'tile metric rate')

    this.element.append(
      new HudIcon(icons, frame, 'icon icon--sm').element,
      new HudLabel(label).element,
      this.value.element,
      new HudUnit('/시간').element,
    )
  }

  setValue(value: number): void {
    // 줄고 있으면 부호가 이미 붙어 있습니다. 늘고 있을 때만 `+` 를 얹습니다.
    this.value.setText(`${value > 0 ? '+' : ''}${formatAmount(value, 1)}`)
    this.toggleClass('rate--up', value > 0)
    this.toggleClass('rate--down', value < 0)
  }
}

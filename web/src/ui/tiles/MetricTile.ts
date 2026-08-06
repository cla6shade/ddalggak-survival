import { UiElement } from '../UiElement'
import { HudIcon } from '../primitives/HudIcon'
import { HudLabel } from '../primitives/HudLabel'
import { HudValue } from '../primitives/HudValue'
import { HudDelta } from '../primitives/HudDelta'
import { formatAmount } from '../format/formatAmount'
import type { IconSheet } from '@/assets/IconSheet'
import type { AtlasFrame } from '@/generated/atlas'

/**
 * 값 하나와 어제 대비 증감을 함께 보여주는 타일.
 * `moreIsGood` 이 거짓이면 증감의 좋고 나쁨이 뒤집힙니다.
 */
export class MetricTile extends UiElement {
  private readonly value = new HudValue()
  private readonly delta = new HudDelta()
  private readonly moreIsGood: boolean

  constructor(icons: IconSheet, frame: AtlasFrame, label: string, moreIsGood: boolean) {
    super('div', 'tile metric')
    this.moreIsGood = moreIsGood

    this.element.append(
      new HudIcon(icons, frame, 'icon icon--sm').element,
      new HudLabel(label).element,
      this.value.element,
      this.delta.element,
    )
  }

  /** `previous` 가 `null` 이면 비교할 어제가 없다는 뜻입니다. */
  setValue(value: number, previous: number | null): void {
    this.value.setText(formatAmount(value))
    this.delta.setDelta(previous === null ? null : value - previous, this.moreIsGood)
  }
}
